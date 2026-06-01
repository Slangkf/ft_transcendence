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
import { ReadyTimerService } from "../game/ready-timer.service";

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
        private readyTimer: ReadyTimerService,
    ) {}

    /**
     * Add a player to the tournament queue. If the queue reaches TOURNAMENT_SIZE,
     * a new tournament is built and started.
     */
    async joinQueue(userId: string, nickname: string): Promise<{ status: 'waiting' | 'started'; tournamentId?: string; lobby?: { size: number; players: TournamentPlayer[] } }> {
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

        // not enough players yet — broadcast the lobby so everyone waiting sees the arrivals
        const lobby = await this.broadcastLobby();
        return { status: 'waiting', lobby };
    }

    /**
     * Read the current tournament lobby (first TOURNAMENT_SIZE players in the queue)
     * and push it to each of them so they can see who has arrived.
     */
    private async broadcastLobby(): Promise<{ size: number; players: TournamentPlayer[] }> {
        const queue = await this.matchService.getQueue(GameMode.TOURNAMENT);
        const players = queue.slice(0, TOURNAMENT_SIZE);
        await Promise.all(
            players.map(p => this.emitter.toUser(p.userId, 'lobby_update', { size: TOURNAMENT_SIZE, players }))
        );
        return { size: TOURNAMENT_SIZE, players };
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
     * Serialize read-modify-write mutations of a single tournament's state.
     * Several events can fire at almost the same instant (both semi-finals
     * finishing together, a forfeit racing a match result, two games starting
     * at once). Without a lock they each get/mutate/save the shared state and
     * clobber each other — e.g. both semis' onMatchFinished see "both done +
     * final pending" and each create the final, spawning two final rooms/games.
     */
    private async withTournamentLock<T>(tournamentId: string, fn: () => Promise<T>): Promise<T | undefined> {
        const lockKey = `lock:tournament:${tournamentId}`;
        let acquired: string | null = null;
        for (let i = 0; i < 60 && !acquired; i++) {
            acquired = await this.redis.set(lockKey, '1', { NX: true, EX: 10 });
            if (!acquired) await new Promise(r => setTimeout(r, 50));
        }
        if (!acquired) {
            console.error(`withTournamentLock: could not acquire lock for ${tournamentId}`);
            return undefined;
        }
        try {
            return await fn();
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
                if (socketId) {
                    const sock = this.gameNs.sockets.get(socketId);
                    sock?.join(room.roomId);
                    // (re)join the tournament-wide room here too: the join in
                    // tryStart() has no retry and can miss a socket that wasn't
                    // registered yet, which would silently cut that player off
                    // from every bracket/spectator/finished broadcast.
                    sock?.join(`tournament:${state.tournamentId}`);
                }

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

            // start the readiness countdown for this match (forfeit on no-show)
            this.readyTimer.arm(room.roomId);
        }
    }

    /**
     * Readiness deadline expired for a tournament match: at least one player
     * never clicked "Ready".
     *   - one player ready  -> they win the match by forfeit;
     *   - nobody ready       -> the match has no winner; the bracket collapses
     *     to the other semi-final's result (handled in advance()/finish()).
     * Every player of the match is sent back to the bracket.
     */
    async handleReadyTimeout(tournamentId: string, roomId: string, notReadyUserIds: string[]): Promise<void> {
        await this.withTournamentLock(tournamentId, async () => {
            const state = await this.repo.get(tournamentId);
            if (!state || state.status === 'finished') return;

            const bm = state.matches.find(m => m.roomId === roomId);
            // ignore if the game already started or the match is already resolved
            if (!bm || bm.status === 'done' || bm.status === 'playing') return;

            const matchPlayers = [bm.p1, bm.p2].filter((x): x is string => !!x);
            const survivors = matchPlayers.filter(uid => !notReadyUserIds.includes(uid));

            for (const uid of notReadyUserIds) {
                if (!state.withdrawn.includes(uid)) state.withdrawn.push(uid);
            }

            bm.winnerId = survivors.length === 1 ? survivors[0] : undefined; // both idle => no winner
            bm.status = 'done';

            // every player of this match leaves the room and returns to the bracket
            await Promise.all(matchPlayers.map(uid =>
                this.sessionService.update(uid, {
                    status: 'in_tournament',
                    roomId: undefined,
                    gameId: undefined,
                })
            ));
            await Promise.all(matchPlayers.map(uid =>
                this.emitter.toUser(uid, 'ready_timeout', {
                    roomId,
                    excluded: notReadyUserIds.includes(uid),
                })
            ));

            await this.advance(state);
        });
    }

    /**
     * Find a bracket match by its gameId (set when the game starts).
     */
    async linkGameToMatch(tournamentId: string, roomId: string, gameId: string): Promise<void> {
        await this.withTournamentLock(tournamentId, async () => {
            const state = await this.repo.get(tournamentId);
            if (!state) return;
            const bm = state.matches.find(m => m.roomId === roomId);
            if (!bm) return;
            bm.gameId = gameId;
            bm.status = 'playing';
            await this.repo.save(state);

            // let spectators know this match is now live (and learn its gameId) so the
            // bracket page can wire its spectator window to the right game stream
            this.emitter.toRoom(`tournament:${tournamentId}`, 'bracket_update', {
                tournamentId,
                bracket: this.toPublic(state),
            });

            // sessions for both players now in_game
            for (const uid of [bm.p1, bm.p2]) {
                if (!uid) continue;
                await this.sessionService.update(uid, {
                    status: 'in_game',
                    gameId,
                    tournamentId,
                });
            }
        });
    }

    /**
     * Called when a tournament-linked game finishes.
     */
    async onMatchFinished(tournamentId: string, gameId: string, winnerId: string, stats?: { userId: string; correctAnswers: number; totalTime: number }[]): Promise<void> {
        await this.withTournamentLock(tournamentId, async () => {
            const state = await this.repo.get(tournamentId);
            if (!state || state.status === 'finished') return;

            const bm = state.matches.find(m => m.gameId === gameId);
            // Idempotent under the lock: if a concurrent trigger (the other semi
            // finishing, or a forfeit) already resolved this match, bail out so we
            // don't advance — or create the next round — twice.
            if (!bm || bm.status === 'done') return;

            bm.winnerId = winnerId;
            bm.status = 'done';

            if (stats?.length) {
                state.playerStats = state.playerStats ?? {};
                for (const s of stats) {
                    state.playerStats[s.userId] = { correctAnswers: s.correctAnswers, totalTime: s.totalTime };
                }
            }

            await this.advance(state);
        });
    }

    /**
     * A player forfeits the current match (disconnection timer expired).
     * If they have a current match in 'ready' or 'playing', the opponent wins.
     */
    async forfeit(tournamentId: string, userId: string): Promise<void> {
        await this.withTournamentLock(tournamentId, async () => {
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
        });
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
        const r1 = state.matches.filter(m => m.round === 1);
        const winnerId = final.winnerId ?? '';

        // 3rd/4th tie-break: more correct answers first, then less time taken
        const byStats = (a: string, b: string) => {
            const sa = state.playerStats?.[a];
            const sb = state.playerStats?.[b];
            const ca = sa?.correctAnswers ?? -1;
            const cb = sb?.correctAnswers ?? -1;
            if (cb !== ca) return cb - ca;
            return (sa?.totalTime ?? Infinity) - (sb?.totalTime ?? Infinity);
        };

        // Build the ranking from the full player list so all 4 always appear
        // exactly once — even when a semi-final collapsed (double no-show) and
        // no real final was ever played.
        const ranking: string[] = [];
        const push = (id?: string) => { if (id && !ranking.includes(id)) ranking.push(id); };

        if (winnerId) {
            // 1st: champion
            push(winnerId);

            // 2nd: runner-up. If a real final happened, it's the other finalist.
            // Otherwise (a semi-final collapsed) it's the loser of the champion's
            // own semi-final.
            if (final.p1 && final.p2) {
                push(final.p1 === winnerId ? final.p2 : final.p1);
            } else {
                const champSemi = r1.find(m => m.p1 === winnerId || m.p2 === winnerId);
                if (champSemi) push(champSemi.p1 === winnerId ? champSemi.p2 : champSemi.p1);
            }
        } else if (final.p1 && final.p2) {
            // Both finalists abandoned the final (double no-show): there is no
            // real champion. Rather than declaring one arbitrarily, rank the two
            // finalists between themselves by stats — they still reached the
            // final, so they take 1st/2nd ahead of the semi-final losers.
            [final.p1, final.p2].sort(byStats).forEach(push);
        }

        // 3rd/4th (and any leftover): everyone else, best stats first
        state.players
            .map(p => p.userId)
            .filter(id => !ranking.includes(id))
            .sort(byStats)
            .forEach(push);

        // Keep the announced winner consistent with what the bracket displays
        // (finalRanking[0]); covers the double no-show case where final.winnerId
        // was never set.
        const champion = winnerId || ranking[0] || '';

        state.status = 'finished';
        state.finishedAt = Date.now();
        state.finalRanking = ranking;
        await this.repo.save(state);

        this.emitter.toRoom(`tournament:${state.tournamentId}`, 'tournament_finished', {
            tournamentId: state.tournamentId,
            bracket: this.toPublic(state),
            winnerId: champion,
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

        // update the lobby for anyone still waiting
        await this.broadcastLobby();
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
            playerStats: state.playerStats,
        };
    }
}
