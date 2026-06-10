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
import { QuestionTimerService } from "../game/question-timer.service";
import { BlockchainService, OnchainTournament } from "../blockchain/blockchain.service";

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
        private blockchain: BlockchainService,
        private questionTimer: QuestionTimerService,
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

            // The matchmaking record only existed to dequeue these 4 players.
            // Delete it like plain multiplayer does (game.multi.ts): otherwise a
            // lingering record makes getMyMatch() return a roomId-less match, which
            // breaks tournament reconnection in the 'matched' state (the bracket
            // room in session.roomId is ignored). See socket.gamehandler 'matched'.
            await this.matchService.deleteMatch(match.matchId);

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
            console.log(`[TOURNEY] tournament FORMED t=${tournamentId} players=[${players.map(p => p.userId).join(',')}]`);

            // mark all players as in_tournament
            await Promise.all(
                players.map(p => this.sessionService.update(p.userId, {
                    status: 'in_tournament',
                    tournamentId,
                }))
            );

            // make sure ALL of every player's sockets join the tournament-wide room
            // (via the per-user room) so broadcasts reach every tab, with no reliance
            // on a single volatile socketId pointer.
            await Promise.all(
                players.map(p =>
                    this.gameNs.in(`user:${p.userId}`).socketsJoin(`tournament:${tournamentId}`)
                )
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
            console.log(`[TOURNEY] createMatchRoom t=${state.tournamentId} round=${bm.round} slot=${bm.slot} room=${room.roomId} p1=${p1.userId} p2=${p2.userId}`);
            console.log(`[JUMP] createMatchRooms() round=${bm.round} slot=${bm.slot} room=${room.roomId.slice(0, 8)} -> these players are being SENT INTO a${bm.round === 2 ? ' FINAL' : ' new'} match: p1=${p1.nickname}#${p1.userId} p2=${p2.nickname}#${p2.userId}`);

            // Join ALL of each player's sockets (every tab) to the match room AND the
            // tournament room, via the per-user room. No socketId lookup, no retry: a
            // player who isn't connected at this instant re-joins session.roomId on
            // reconnect (handleReconnect, set just below) and the bracket HTTP poll
            // also redirects them — so a momentary disconnect no longer bounces them.
            for (const player of [p1, p2]) {
                const prevSession = await this.sessionService.get(player.userId);
                await this.gameNs.in(`user:${player.userId}`).socketsJoin([room.roomId, `tournament:${state.tournamentId}`]);
                console.log(`[TOURNEY]   join p=${player.userId} room=${room.roomId} (socketsJoin via user room)`);
                console.log(`[JUMP]   session p=${player.userId} ${prevSession?.status ?? 'none'}(room=${prevSession?.roomId?.slice(0, 8) ?? '-'},game=${prevSession?.gameId?.slice(0, 8) ?? '-'}) -> matched(room=${room.roomId.slice(0, 8)}) + next_match_ready emitted`);

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
        console.log(`[TOURNEY] READY-TIMEOUT (forfeit) t=${tournamentId} room=${roomId} notReady=[${notReadyUserIds.join(',')}] -> players bounced to bracket`);
        await this.withTournamentLock(tournamentId, async () => {
            const state = await this.repo.get(tournamentId);
            if (!state || state.status === 'finished') return;

            const bm = state.matches.find(m => m.roomId === roomId);
            // ignore if the game already started or the match is already resolved
            if (!bm || bm.status === 'done' || bm.status === 'playing') {
                console.log(`[TOURNEY] READY-TIMEOUT ignored (match already ${bm?.status ?? 'gone'})`);
                return;
            }

            const matchPlayers = [bm.p1, bm.p2].filter((x): x is string => !!x);
            const survivors = matchPlayers.filter(uid => !notReadyUserIds.includes(uid));
            console.log(`[JUMP] READY-TIMEOUT (eject) match R${bm.round}.${bm.slot} room=${roomId.slice(0, 8)} players=[${matchPlayers.join(',')}] notReady=[${notReadyUserIds.join(',')}] survivors=[${survivors.join(',')}] -> winner=${survivors.length === 1 ? survivors[0] : 'NONE'}; ALL these players bounced to bracket`);

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
            console.log(`[TOURNEY] match PLAYING t=${tournamentId} room=${roomId} game=${gameId} (game actually started)`);
            console.log(`[JUMP] linkGameToMatch() match R${bm.round}.${bm.slot} room=${roomId.slice(0, 8)} -> PLAYING game=${gameId.slice(0, 8)} p1=${bm.p1} p2=${bm.p2} (both sessions -> in_game)`);

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
        console.log(`[TOURNEY] matchFinished t=${tournamentId} game=${gameId} winner=${winnerId}`);
        await this.withTournamentLock(tournamentId, async () => {
            const state = await this.repo.get(tournamentId);
            if (!state || state.status === 'finished') return;

            const bm = state.matches.find(m => m.gameId === gameId);
            // Idempotent under the lock: if a concurrent trigger (the other semi
            // finishing, or a forfeit) already resolved this match, bail out so we
            // don't advance — or create the next round — twice.
            if (!bm) {
                console.log(`[JUMP] onMatchFinished() NO bracket match for game=${gameId.slice(0, 8)} — ignored. ${this.snap(state)}`);
                return;
            }
            if (bm.status === 'done') {
                console.log(`[JUMP] onMatchFinished() match R${bm.round}.${bm.slot} ALREADY done (idempotent bail) — ignored`);
                return;
            }
            console.log(`[JUMP] onMatchFinished() NORMAL finish: match R${bm.round}.${bm.slot} game=${gameId.slice(0, 8)} winner=${winnerId} -> mark done, both players already reset to in_tournament by gamehandler`);

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
        console.log(`[TOURNEY] FORFEIT (disconnect) t=${tournamentId} user=${userId}`);
        await this.withTournamentLock(tournamentId, async () => {
            const state = await this.repo.get(tournamentId);
            if (!state || state.status === 'finished') return;

            if (!state.withdrawn.includes(userId)) state.withdrawn.push(userId);

            // Only an ACTIVE match (room created & awaiting ready, or game running)
            // can be forfeited here. A 'pending' match — crucially the FINAL while it
            // still waits for the other semi-final — must NOT be force-resolved: its
            // opponent isn't known yet, so we'd mark the final 'done' with no winner,
            // and advance() would then skip creating the real final (its guard requires
            // final.status === 'pending') → the tournament ends on a final nobody
            // played. A player who abandons while their next match is still pending is
            // already handled by the `withdrawn` list + advance()'s auto-forfeit check.
            const bm = state.matches.find(m =>
                (m.p1 === userId || m.p2 === userId) &&
                (m.status === 'ready' || m.status === 'playing')
            );
            if (bm) {
                const opponentId = bm.p1 === userId ? bm.p2 : bm.p1;
                if (opponentId) {
                    bm.winnerId = opponentId;
                }
                bm.status = 'done';
                console.log(`[JUMP] FORFEIT resolves ACTIVE match R${bm.round}.${bm.slot} (was ${bm.status}) user=${userId} -> opponent=${opponentId ?? '-'} wins; both bounced to bracket`);
            } else {
                console.log(`[JUMP] FORFEIT user=${userId} has NO active(ready/playing) match — only added to withdrawn=[${state.withdrawn.join(',')}] (pending match left untouched)`);
            }
            await this.advance(state);
        });
    }

    /**
     * Update bracket state after a match is done: create next round rooms,
     * or finish the tournament if all matches are done.
     */
    private async advance(state: TournamentState): Promise<void> {
        console.log(`[JUMP] advance() ENTER ${this.snap(state)}`);
        // propagate R1 winners into the final slot
        const r1 = state.matches.filter(m => m.round === 1);
        const final = state.matches.find(m => m.round === 2 && m.slot === 0)!;

        const r1AllDone = r1.every(m => m.status === 'done');
        console.log(`[JUMP] advance() r1AllDone=${r1AllDone} finalStatus=${final.status} r1=[${r1.map(m => `slot${m.slot}:${m.status}/win=${m.winnerId ?? '-'}`).join(', ')}]`);

        if (r1AllDone && final.status === 'pending') {
            const w0 = r1.find(m => m.slot === 0)?.winnerId;
            const w1 = r1.find(m => m.slot === 1)?.winnerId;
            console.log(`[JUMP] advance() filling FINAL from semis: w0=${w0 ?? '-'} w1=${w1 ?? '-'}`);

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
                    console.log(`[JUMP] advance() FINAL auto-forfeit (w0Out=${w0Out} w1Out=${w1Out}) winner=${final.winnerId ?? '-'} — NO final room created`);
                } else {
                    console.log(`[JUMP] advance() -> creating FINAL room for ${w0} vs ${w1} (these two are PROMOTED into a new match)`);
                    await this.createMatchRooms(state, [final]);
                }
            } else {
                // double forfeit, or one R1 had no winner — tournament cannot continue normally
                final.status = 'done';
                final.winnerId = w0 ?? w1; // whoever remains
                console.log(`[JUMP] advance() FINAL collapsed (a semi had no winner) winner=${final.winnerId ?? '-'}`);
            }
        }

        // broadcast bracket update
        await this.repo.save(state);
        console.log(`[JUMP] advance() -> emit bracket_update to tournament:${state.tournamentId.slice(0, 8)} ${this.snap(state)}`);
        this.emitter.toRoom(`tournament:${state.tournamentId}`, 'bracket_update', {
            tournamentId: state.tournamentId,
            bracket: this.toPublic(state),
        });

        // check for tournament end
        if (state.matches.every(m => m.status === 'done')) {
            console.log(`[JUMP] advance() ALL matches done -> finish()`);
            await this.finish(state);
        }
    }

    /*
     * Ends the tournament: computes the final 1st-4th ranking (with stats
     * tie-breaks and collapsed-bracket fallbacks), marks it finished, emits
     * tournament_finished, frees every player's session, and records the
     * result on-chain (fire-and-forget).
     */
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

        console.log(`[JUMP] finish() champion=${champion} ranking=[${ranking.join(',')}] -> emit tournament_finished + free all sessions to idle`);
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

        // Persist the final scores on the blockchain. Fire-and-forget: a Fuji
        // confirmation takes a few seconds and must neither hold the tournament
        // lock nor delay the players' return to idle. The helper does its own
        // error handling, so a chain failure never affects the tournament.
        void this.recordOnchain(state, champion, ranking);
    }

    /**
     * Write the finished tournament's scores to the blockchain and, on success,
     * broadcast the transaction hash so the bracket page can show a verifiable
     * on-chain badge. Never throws.
     */
    private async recordOnchain(state: TournamentState, champion: string, ranking: string[]): Promise<void> {
        if (!this.blockchain.isEnabled()) return;
        try {
            const players = ranking.map((uid, i) => {
                const player = state.players.find(p => p.userId === uid);
                const stats = state.playerStats?.[uid];
                return {
                    nickname: player?.nickname ?? uid,
                    score: stats?.correctAnswers ?? 0,
                    rank: i + 1,
                };
            });
            const championNickname = state.players.find(p => p.userId === champion)?.nickname ?? '';

            const txHash = await this.blockchain.recordTournament(state.tournamentId, championNickname, players);
            if (txHash) {
                this.emitter.toRoom(`tournament:${state.tournamentId}`, 'tournament_onchain', {
                    tournamentId: state.tournamentId,
                    txHash,
                    explorerUrl: this.blockchain.explorerTxUrl(txHash),
                });
            }
        } catch (e) {
            console.error(`[blockchain] failed to record tournament ${state.tournamentId}`, e);
        }
    }

    /** Read a finished tournament's scores back from the blockchain. */
    async getOnchainScores(tournamentId: string): Promise<OnchainTournament | null> {
        return this.blockchain.getTournament(tournamentId);
    }

    /**
     * Cleanly remove a player from their current tournament (forfeit if needed)
     * and reset their session so they can join a new one.
     */
    async leave(userId: string): Promise<void> {
        // HARD GUARD: a player who is actively in a match (in a ready room or
        // mid-game) must NEVER be torn out of it by an out-of-band /leave HTTP call.
        // This is the real cause of the "a player jumps" bug: with the auth cookie
        // shared across tabs, a SECOND tab sitting on the tournament lobby (or a
        // re-click of "Join") fires joinTournament(), whose cleanup used to POST
        // /leave — which forfeited the user from the very tournament their first tab
        // was playing, INSTANTLY (not after any timer). A real match is only ever
        // resolved by the game's own score/ready timers, never by this endpoint.
        const session = await this.sessionService.get(userId);
        if (session?.status === 'in_game' || session?.status === 'matched') {
            console.log(`[TOURNEY] leave() IGNORED user=${userId} (status=${session.status}: in an active match)`);
            return;
        }

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

    /* Returns the public (client-safe) bracket view of a tournament, or null. */
    async getPublic(tournamentId: string): Promise<PublicBracketView | null> {
        const state = await this.repo.get(tournamentId);
        if (!state) return null;
        return this.toPublic(state);
    }

    /* Returns the full tournament state the given user currently belongs to, or null. */
    async getByUser(userId: string): Promise<TournamentState | null> {
        return this.repo.getByUser(userId);
    }

    /**
     * Re-arm in-memory readiness deadlines after a backend restart.
     *
     * ReadyTimerService keeps its timers in memory, so a restart drops every
     * pending "Ready" deadline — a match waiting on ready-up would then hang
     * forever (no forfeit ever fires) until the 2h Redis TTL. On boot we scan the
     * running tournaments still in Redis and re-arm the deadline for each match
     * still in 'ready'. Best-effort: never throws.
     */
    async rearmPendingDeadlines(): Promise<void> {
        try {
            const keys = await this.redis.keys(RedisKeys.tournament.state('*'));
            let rearmed = 0;
            for (const key of keys) {
                const data = await this.redis.get(key);
                if (!data) continue;
                const state = JSON.parse(data) as TournamentState;
                if (state.status !== 'running') continue;
                for (const bm of state.matches) {
                    if (bm.status === 'ready' && bm.roomId) {
                        this.readyTimer.arm(bm.roomId);
                        rearmed++;
                    } else if (bm.status === 'playing' && bm.gameId) {
                        // A match whose GAME was already running when the process died:
                        // its per-question deadline lived only in memory and is now gone,
                        // so the game would never auto-advance (a player who stops
                        // answering would freeze the match forever). Re-arm the question
                        // timer from the persisted game state so play resumes cleanly.
                        void this.questionTimer.schedule(bm.gameId);
                        rearmed++;
                    }
                }
            }
            if (rearmed > 0) {
                console.log(`[tournament] re-armed ${rearmed} deadline(s) after restart`);
            }
        } catch (e) {
            console.error('[tournament] rearmPendingDeadlines failed', e);
        }
    }

    /**
     * Compact one-line snapshot of the whole bracket — used by the [JUMP] logs to
     * reconstruct exactly what the bracket looked like at each return-to-bracket /
     * advance step. Format per match:
     *   R<round>.<slot>{<p1Nick>#<p1id> vs <p2Nick>#<p2id> <status> [win=..] [room=..] [game=..]}
     */
    private snap(state: TournamentState): string {
        const fmt = (bm: BracketMatch) => {
            const p1 = `${bm.p1Nickname ?? '?'}#${bm.p1 ?? '-'}`;
            const p2 = `${bm.p2Nickname ?? '?'}#${bm.p2 ?? '-'}`;
            const win = bm.winnerId ? ` win=${bm.winnerId}` : '';
            const room = bm.roomId ? ` room=${bm.roomId.slice(0, 8)}` : '';
            const game = bm.gameId ? ` game=${bm.gameId.slice(0, 8)}` : '';
            return `R${bm.round}.${bm.slot}{${p1} vs ${p2} ${bm.status}${win}${room}${game}}`;
        };
        return `t=${state.tournamentId.slice(0, 8)} status=${state.status} withdrawn=[${state.withdrawn.join(',')}] ${state.matches.map(fmt).join('  ')}`;
    }

    /* Projects the internal state into the client-facing bracket view (drops server-only fields). */
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
