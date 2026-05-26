import { randomUUID } from "crypto";
import { Namespace } from "socket.io";
import { Redis, RedisKeys } from "../lib/redis";
import { AppError, ErrorCode } from "../error/apperror";
import { MatchService } from "../game/match/match.service";
import { RoomService } from "../room/room.service";
import { SessionService } from "../game/session.service";
import { GameEmitter } from "../websocket/socket.emitter";
import { MatchPlayer } from "../game/game.types";
import { GameMode } from "@prisma/client";
import { TournamentRepository } from "./tournament.repository";
import { BracketMatch, PublicBracketView, TournamentPlayer, TournamentState } from "./tournament.types";

const TOURNAMENT_SIZE = 4;

export class TournamentService {
    constructor(
        private repo: TournamentRepository,
        private matchService: MatchService,
        private roomService: RoomService,
        private sessionService: SessionService,
        private emitter: GameEmitter,
        private gameNs: Namespace,
        private redis: typeof Redis,
    ) {}

    /**
     * Add a player to the tournament queue. If the queue reaches TOURNAMENT_SIZE,
     * a new tournament is built and started.
     */
    async joinQueue(userId: string, nickname: string): Promise<{ status: 'waiting' | 'started'; tournamentId?: string }> {
        // is the user already in a tournament?
        const existing = await this.repo.getByUser(userId);
        if (existing && existing.status !== 'finished') {
            await this.sessionService.update(userId, {
                status: 'in_tournament',
                tournamentId: existing.tournamentId,
            });
            return { status: 'started', tournamentId: existing.tournamentId };
        }

        await this.sessionService.update(userId, { status: 'queue' });
        await this.matchService.joinQueue({
            mode: GameMode.TOURNAMENT,
            userId,
            nickname,
            size: TOURNAMENT_SIZE,
        });

        const started = await this.tryStart();
        if (started) return { status: 'started', tournamentId: started.tournamentId };
        return { status: 'waiting' };
    }

    /**
     * Try to form a tournament from the queue. Returns the new TournamentState or null.
     */
    async tryStart(): Promise<TournamentState | null> {
        const lockKey = `lock:tournament-start:v1`;
        // try a few times: another concurrent join might hold the lock briefly
        let acquired: string | null = null;
        for (let i = 0; i < 5 && !acquired; i++) {
            acquired = await this.redis.set(lockKey, '1', { NX: true, EX: 10 });
            if (!acquired) await new Promise(r => setTimeout(r, 80));
        }
        if (!acquired) return null;

        try {
            const match = await this.matchService.matchPlayers(GameMode.TOURNAMENT, TOURNAMENT_SIZE);
            if (!match) return null;

            const tournamentId = randomUUID();
            const players: TournamentPlayer[] = match.players.map(p => ({
                userId: String(p.userId),
                nickname: p.nickname,
            }));

            // build empty bracket
            const matches: BracketMatch[] = [
                { round: 1, slot: 0, p1: players[0].userId, p2: players[1].userId,
                  p1Nickname: players[0].nickname, p2Nickname: players[1].nickname, status: 'pending' },
                { round: 1, slot: 1, p1: players[2].userId, p2: players[3].userId,
                  p1Nickname: players[2].nickname, p2Nickname: players[3].nickname, status: 'pending' },
                { round: 2, slot: 0, status: 'pending' },
            ];

            const state: TournamentState = {
                tournamentId,
                size: TOURNAMENT_SIZE,
                status: 'running',
                players,
                matches,
                withdrawn: [],
                startedAt: Date.now(),
            };

            await this.repo.save(state);

            // mark all players as in_tournament
            await Promise.all(
                players.map(p => this.sessionService.update(p.userId, {
                    status: 'in_tournament',
                    tournamentId,
                }))
            );

            // make sure all players join a tournament-wide socket room so we can broadcast
            await Promise.all(
                players.map(async p => {
                    const socketId = await this.redis.get(RedisKeys.socket.gameUser(p.userId));
                    if (socketId) this.gameNs.sockets.get(socketId)?.join(`tournament:${tournamentId}`);
                })
            );

            // 1. announce the tournament so frontends can navigate to the bracket page
            this.emitter.toRoom(`tournament:${tournamentId}`, 'tournament_started', {
                tournamentId,
                bracket: this.toPublic(state),
            });

            // 2. create the R1 rooms (mutates matches: roomId + status='ready') and emit next_match_ready per player
            await this.createMatchRooms(state, state.matches.filter(m => m.round === 1));
            await this.repo.save(state);

            // 3. broadcast the updated bracket so the bracket page sees roomIds and statuses
            this.emitter.toRoom(`tournament:${tournamentId}`, 'bracket_update', {
                tournamentId,
                bracket: this.toPublic(state),
            });
            return state;
        } finally {
            await this.redis.del(lockKey);
        }
    }

    /**
     * Build a Room for each given bracket match (both players must still be present).
     * Emits `next_match_ready` to each participant.
     */
    private async createMatchRooms(state: TournamentState, bracketMatches: BracketMatch[]): Promise<void> {
        for (const bm of bracketMatches) {
            if (!bm.p1 || !bm.p2 || bm.status !== 'pending') continue;
            const p1 = state.players.find(p => p.userId === bm.p1)!;
            const p2 = state.players.find(p => p.userId === bm.p2)!;

            const room = await this.roomService.createRoom({
                hostId: p1.userId,
                hostNickname: p1.nickname,
                players: [
                    { userId: p1.userId, nickname: p1.nickname },
                    { userId: p2.userId, nickname: p2.nickname },
                ],
                maxPlayers: 2,
                type: 'game',
                tournamentId: state.tournamentId,
            });

            bm.roomId = room.roomId;
            bm.status = 'ready';

            // join each player's socket to the room (retry in case onConnection Redis key is not written yet)
            for (const player of [p1, p2]) {
                let socketId: string | null = null;
                for (let attempt = 0; attempt < 5 && !socketId; attempt++) {
                    socketId = await this.redis.get(RedisKeys.socket.gameUser(player.userId));
                    if (!socketId) await new Promise(r => setTimeout(r, 80));
                }
                if (socketId) this.gameNs.sockets.get(socketId)?.join(room.roomId);

                await this.sessionService.update(player.userId, {
                    status: 'matched',
                    roomId: room.roomId,
                    tournamentId: state.tournamentId,
                });

                const opponent = player.userId === p1.userId ? p2 : p1;
                await this.emitter.toUser(player.userId, 'next_match_ready', {
                    tournamentId: state.tournamentId,
                    roomId: room.roomId,
                    opponentId: opponent.userId,
                    opponentNickname: opponent.nickname,
                    round: bm.round,
                    players: [
                        { userId: p1.userId, nickname: p1.nickname },
                        { userId: p2.userId, nickname: p2.nickname },
                    ],
                });
            }
        }
    }

    /**
     * Find a bracket match by its gameId (set when the game starts).
     */
    async linkGameToMatch(tournamentId: string, roomId: string, gameId: string): Promise<void> {
        const state = await this.repo.get(tournamentId);
        if (!state) return;
        const bm = state.matches.find(m => m.roomId === roomId);
        if (!bm) return;
        bm.gameId = gameId;
        bm.status = 'playing';
        await this.repo.save(state);

        // sessions for both players now in_game
        for (const uid of [bm.p1, bm.p2]) {
            if (!uid) continue;
            await this.sessionService.update(uid, {
                status: 'in_game',
                gameId,
                tournamentId,
            });
        }
    }

    /**
     * Called when a tournament-linked game finishes.
     */
    async onMatchFinished(tournamentId: string, gameId: string, winnerId: string): Promise<void> {
        const state = await this.repo.get(tournamentId);
        if (!state || state.status === 'finished') return;

        const bm = state.matches.find(m => m.gameId === gameId);
        if (!bm || bm.status === 'done') return;

        bm.winnerId = winnerId;
        bm.status = 'done';

        await this.advance(state);
    }

    /**
     * A player forfeits the current match (disconnection timer expired).
     * If they have a current match in 'ready' or 'playing', the opponent wins.
     */
    async forfeit(tournamentId: string, userId: string): Promise<void> {
        const state = await this.repo.get(tournamentId);
        if (!state || state.status === 'finished') return;

        if (!state.withdrawn.includes(userId)) state.withdrawn.push(userId);

        const bm = state.matches.find(m =>
            (m.p1 === userId || m.p2 === userId) &&
            (m.status === 'ready' || m.status === 'playing' || m.status === 'pending')
        );
        if (bm) {
            const opponentId = bm.p1 === userId ? bm.p2 : bm.p1;
            if (opponentId) {
                bm.winnerId = opponentId;
            }
            bm.status = 'done';
        }
        await this.advance(state);
    }

    /**
     * Update bracket state after a match is done: create next round rooms,
     * or finish the tournament if all matches are done.
     */
    private async advance(state: TournamentState): Promise<void> {
        // propagate R1 winners into the final slot
        const r1 = state.matches.filter(m => m.round === 1);
        const final = state.matches.find(m => m.round === 2 && m.slot === 0)!;

        if (r1.every(m => m.status === 'done') && final.status === 'pending') {
            const w0 = r1.find(m => m.slot === 0)?.winnerId;
            const w1 = r1.find(m => m.slot === 1)?.winnerId;

            if (w0 && w1) {
                final.p1 = w0;
                final.p2 = w1;
                final.p1Nickname = state.players.find(p => p.userId === w0)?.nickname;
                final.p2Nickname = state.players.find(p => p.userId === w1)?.nickname;

                // if one finalist has withdrawn before the final could start, auto-forfeit
                const w0Out = state.withdrawn.includes(w0);
                const w1Out = state.withdrawn.includes(w1);
                if (w0Out || w1Out) {
                    final.winnerId = w0Out && !w1Out ? w1 : (!w0Out && w1Out ? w0 : undefined);
                    final.status = 'done';
                } else {
                    await this.createMatchRooms(state, [final]);
                }
            } else {
                // double forfeit, or one R1 had no winner — tournament cannot continue normally
                final.status = 'done';
                final.winnerId = w0 ?? w1; // whoever remains
            }
        }

        // broadcast bracket update
        await this.repo.save(state);
        this.emitter.toRoom(`tournament:${state.tournamentId}`, 'bracket_update', {
            tournamentId: state.tournamentId,
            bracket: this.toPublic(state),
        });

        // check for tournament end
        if (state.matches.every(m => m.status === 'done')) {
            await this.finish(state);
        }
    }

    private async finish(state: TournamentState): Promise<void> {
        const final = state.matches.find(m => m.round === 2)!;
        const winnerId = final.winnerId ?? '';
        const r1 = state.matches.filter(m => m.round === 1);
        // ranking: winner, finalist, then R1 losers
        const finalistId = final.p1 === winnerId ? final.p2 : final.p1;
        const r1Losers = r1
            .map(m => (m.p1 === m.winnerId ? m.p2 : m.p1))
            .filter((x): x is string => !!x);
        const ranking = [winnerId, finalistId, ...r1Losers].filter((x): x is string => !!x);

        state.status = 'finished';
        state.finishedAt = Date.now();
        state.finalRanking = ranking;
        await this.repo.save(state);

        this.emitter.toRoom(`tournament:${state.tournamentId}`, 'tournament_finished', {
            tournamentId: state.tournamentId,
            bracket: this.toPublic(state),
            winnerId,
            ranking,
        });

        // free sessions
        await Promise.all(
            state.players.map(p => this.sessionService.update(p.userId, {
                status: 'idle',
                tournamentId: undefined,
                roomId: undefined,
                gameId: undefined,
            }))
        );
    }

    /**
     * Cleanly remove a player from their current tournament (forfeit if needed)
     * and reset their session so they can join a new one.
     */
    async leave(userId: string): Promise<void> {
        // Remove from matchmaking queue in case they were still waiting
        await this.matchService.leaveQueue(userId);

        const state = await this.repo.getByUser(userId);
        if (state && state.status !== 'finished') {
            await this.forfeit(state.tournamentId, userId);
        }

        // Clear the user→tournament index so getByUser returns null
        await this.redis.del(RedisKeys.tournament.user(userId));

        // Reset session
        await this.sessionService.update(userId, {
            status: 'idle',
            tournamentId: undefined,
            roomId: undefined,
            gameId: undefined,
        });
    }

    async getPublic(tournamentId: string): Promise<PublicBracketView | null> {
        const state = await this.repo.get(tournamentId);
        if (!state) return null;
        return this.toPublic(state);
    }

    async getByUser(userId: string): Promise<TournamentState | null> {
        return this.repo.getByUser(userId);
    }

    private toPublic(state: TournamentState): PublicBracketView {
        return {
            tournamentId: state.tournamentId,
            status: state.status,
            players: state.players,
            matches: state.matches,
            finalRanking: state.finalRanking,
        };
    }
}
