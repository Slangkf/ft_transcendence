//import { RoomManager } from "src/room/room.manager";
import { GameEmitter } from "./socket.emitter";
import { Namespace, Socket } from "socket.io";
import { Redis, RedisKeys } from "../lib/redis"
import { ClientToServerEvents, ServerToClientEvents, SubmitAnswerRes } from "./socket.types";
import { StatementSync } from "node:sqlite";
import { RoomService } from "../room/room.service";
import { MatchService } from "../game/match/match.service";
import { RedisGameRepository } from "../game/game.redis.repository";
import { GameService } from "../game/game.service";
import { SessionService } from "../game/session.service";
import { TournamentService } from "../tournament/tournament.service";
import { GameMapper } from "src/game/game.mapper";
import {SubmitAnswerReq} from "@shared/game.schema";
import { QuestionTimerService } from "../game/question-timer.service";
import { GameState } from "../game/game.types";

type TypedNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>; //socket <listend, emit>;

export class GameSocketHandler{
    private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(
        private io: TypedNamespace,
        private redis: typeof Redis,
        private roomservice: RoomService ,
        private matchservice: MatchService,
        private gamerepos: RedisGameRepository,
        private emitter: GameEmitter,
        private gameService: GameService,
        private sessionService: SessionService,
        private tournamentService: TournamentService,
        private mapper: GameMapper,
        private questionTimer: QuestionTimerService,
    ){}

    private gameuserkey(userId: string){
        return RedisKeys.socket.gameUser(userId);
    }
    private disconnectkey(userId: string){
        return RedisKeys.socket.disconnect(userId);
    }
    /**
     * Per-user Socket.IO room. EVERY one of a user's /game sockets joins it, so:
     *  - targeted emits (`toUser`) reach all their tabs instead of a single volatile
     *    socketId pointer that the SECOND tab/reconnect would steal;
     *  - "is the user offline?" = "are there zero sockets left in this room?".
     * This is what makes multi-tab / shared-cookie / reconnect churn non-destructive.
     */
    private userRoom(userId: string){
        return `user:${userId}`;
    }

    async onConnection(socket: TypedSocket): Promise<void>{
        const userId = socket.data.userId;

        // join the per-user room first thing, so this socket is reachable by toUser
        // and counted as "online" immediately
        socket.join(this.userRoom(userId));

        //delete from disconnect timer if exist
        const existingTimer = this.disconnectTimers.get(userId);
        if (existingTimer){
            clearTimeout(existingTimer);
            this.disconnectTimers.delete(userId);
        }
        await this.redis.del(this.disconnectkey(userId));

        // save in redis
        const prevSocketId = await this.redis.get(this.gameuserkey(userId));
        if (prevSocketId && prevSocketId !== socket.id) {
            // Same userId already had a live game socket. This happens when the
            // SAME account is opened in two windows/tabs (Chrome shares the
            // auth_token cookie across them — and across incognito windows of the
            // same session). The new socketId overwrites the old one in Redis, so
            // only the LAST connection receives `toUser` emits → the other window
            // silently stops getting next_match_ready / matched / etc.
            console.warn(`[WS] user=${userId} reconnect/2nd-socket new=${socket.id} REPLACES prev=${prevSocketId} (same account in 2 places? cookie shared?)`);
        }
        console.log(`[WS] connect user=${userId} socket=${socket.id}`);
        await this.redis.set(this.gameuserkey(userId), socket.id);

        // make sure a session exists for this user (otherwise sessionService.update is a no-op
        // and the room/queue state is never persisted, so reconnect can't restore it)
        const existingSession = await this.sessionService.get(userId);
        if (!existingSession) {
            await this.sessionService.init(userId, socket.id);
        } else {
            await this.sessionService.update(userId, { socketId: socket.id });
        }

        await this.handleReconnect(socket, userId);

        socket.on('disconnect', ()=>this.onDisconnect(socket, userId))
        socket.on('submit_answer', (
            data: SubmitAnswerReq,
            ack:(response: SubmitAnswerRes) => void
        ) => {this.onSubmitAnswer(socket, userId, data, ack)});
        // On-demand state pull. The /game socket is now persistent across navigation,
        // so a page (e.g. the in-game page) can no longer rely on a reconnect to
        // receive `session_reconnect`. It emits `request_sync` on mount and we replay
        // the authoritative current state (current question, scores, in_game/finished)
        // — the robust source of truth instead of a fragile sessionStorage hint.
        socket.on('request_sync', () => {
            this.handleReconnect(socket, userId).catch(e => console.error('request_sync error', e));
        });
    }

    private async handleReconnect(socket: TypedSocket, userId: string): Promise<void>{
        const session = await this.sessionService.get(userId);
        if (!session) {
            console.log(`[WS] reconnect user=${userId} no session`);
            return ;
        }

        const {status} = session;
        console.log(`[WS] reconnect user=${userId} status=${status} room=${session.roomId ?? '-'} game=${session.gameId ?? '-'} tournament=${session.tournamentId ?? '-'} socket=${socket.id}`);
        if (session.roomId){
            socket.join(session.roomId);
        }
        // always rejoin tournament broadcast room if applicable
        if (session.tournamentId){
            socket.join(`tournament:${session.tournamentId}`);
        }
        switch (status){
            case "queue":{
                socket.emit('session_reconnect', {
                    type: "queue",
                    message: "Still in matchmaking queue"
                })
                break;
            }
            case "matched":{
                const match = await this.matchservice.getMyMatch(userId);
                if (!match){
                    const session = await this.sessionService.get(userId);
                    if (session?.roomId){
                        await this.sessionService.update(userId, {status: 'in_room'});
                        const room = await this.roomservice.getRoom(session.roomId);
                        if (room){
                            socket.emit('session_reconnect', {
                                type: 'in_room',
                                roomId: room.roomId,
                                players: Object.values(room.players).map(p => ({
                                    id: p.userId,
                                    nickname: p.nickname,
                                    isReady: p.isReady
                                })),
                                roomStatus: room.status
                            })
                        }
                    } else {
                        await this.sessionService.update(userId, {status: 'idle'})
                    }
                    break;
                }

                console.log(`[JUMP] reconnect/sync user=${userId} REPLAY status=matched -> tells client to go to ROOM room=${match.roomId?.slice(0, 8)} socket=${socket.id}`);
                socket.emit('session_reconnect', {
                    type: "matched",
                    players: match.players,
                    roomId: match.roomId,
                })
                break;
            }
            case "in_room":{
                const room = await this.roomservice.getRoom(session.roomId!);
                if (!room){
                    await this.sessionService.update(userId, {
                        status: "idle"
                });
                break;}
                
                socket.emit('session_reconnect', {
                    type: "in_room",
                    roomId: room.roomId,
                    players: Object.values(room.players).map(p=>({
                        id: p.userId,
                        nickname: p.nickname,
                        isReady: p.isReady,
                    })),
                    roomStatus: room.status
                })
                break;
            }
            case "in_game":{
                if (!session.gameId) break;
                const gamestate = await this.gamerepos.findById(session.gameId);
                if (!gamestate){
                    await this.sessionService.update(userId, {
                        status: "idle"
                });
                break;}
                if (gamestate.isFinished){
                    console.log(`[JUMP] reconnect/sync user=${userId} REPLAY status=in_game but game=${gamestate.gameId.slice(0, 8)} ALREADY FINISHED -> client gets game_finished (will head back to bracket)`);
                    socket.emit('game_finished', {
                        gameId: gamestate.gameId,
                        state: this.mapper.toUpdateResponse(gamestate),
                    });
                    break;
                } else {
                    console.log(`[JUMP] reconnect/sync user=${userId} REPLAY status=in_game game=${gamestate.gameId.slice(0, 8)} qIndex=${gamestate.currentQuestionIndex} -> client stays in PLAY`);
                    socket.emit('session_reconnect', {
                        type: "in_game",
                        gameId: gamestate.gameId,
                        state: this.mapper.toUpdateResponse(gamestate),
                    })
                    break;
                }
            }
            case "in_tournament": {
                if (!session.tournamentId) {
                    await this.sessionService.update(userId, { status: "idle" });
                    socket.emit('session_reconnect', {type: "idle"});
                    break;
                }
                const bracket = await this.tournamentService.getPublic(session.tournamentId);
                if (!bracket) {
                    console.log(`[JUMP] reconnect/sync user=${userId} REPLAY status=in_tournament but bracket GONE -> idle`);
                    await this.sessionService.update(userId, { status: "idle", tournamentId: undefined });
                    socket.emit('session_reconnect', {type: "idle"});
                    break;
                }
                {
                    const myReady = bracket.matches.find(m =>
                        (m.p1 === userId || m.p2 === userId) && m.status === 'ready' && !!m.roomId);
                    console.log(`[JUMP] reconnect/sync user=${userId} REPLAY status=in_tournament -> client gets bracket_update (will sit on BRACKET${myReady ? `, but has a READY room=${myReady.roomId?.slice(0, 8)} R${myReady.round}.${myReady.slot} -> client should redirect itself there` : ', no ready room for me'})`);
                }
                socket.emit('bracket_update', {
                    tournamentId: session.tournamentId,
                    bracket,
                });
                break;
            }
            default:
                socket.emit('session_reconnect', {type: "idle"});
        }
    }

    private async onDisconnect(socket: TypedSocket, userId: string): Promise<void>{
        // Still online? Answered by the per-user room, not a volatile socketId. By the
        // time 'disconnect' fires the socket has already left its rooms, so if ANY
        // socket remains in user:<id> (another tab, or a reconnect that already landed)
        // the user is still here → do nothing. Multi-tab / churn becomes harmless.
        const remaining = await this.io.in(this.userRoom(userId)).fetchSockets();
        console.log(`[JUMP] onDisconnect socket=${socket.id} user=${userId} remainingSockets=${remaining.length}${remaining.length > 0 ? ' -> still online, no-op' : ' -> last socket gone, arming 60s window'}`);
        if (remaining.length > 0) return;

        const RECONNECT_WINDOW_MS = 60_000;
        await this.redis.set(this.disconnectkey(userId), '1', {EX: RECONNECT_WINDOW_MS / 1000});

        const timer = setTimeout(async () => {
            this.disconnectTimers.delete(userId);
            // Guard EVERYTHING: an unhandled rejection in this timer (e.g. a transient
            // Redis error) would otherwise crash the whole process and drop every
            // player. One user's cleanup must never take the server down.
            try {
                const stillDisconnected = await this.redis.get(this.disconnectkey(userId));
                if (!stillDisconnected) return; // reconnected within the window

                const cur = await this.redis.get(this.gameuserkey(userId));
                if (cur === socket.id) await this.redis.del(this.gameuserkey(userId));

                const session = await this.sessionService.get(userId);

                // TOURNAMENT: a disconnect NEVER forfeits/idles/leaves. The session
                // stays intact so the player can reconnect straight back into their
                // match, and the match still resolves on its own — by score (the
                // question timer force-advances unanswered questions until the game
                // finishes) or, if the game never started, by the ready-timeout. This
                // removes the single most damaging mechanism: a transient network blip
                // can no longer eliminate someone from the bracket.
                if (session?.tournamentId) {
                    console.log(`[JUMP] onDisconnect user=${userId} is in tournament=${session.tournamentId.slice(0, 8)} (status=${session.status}) -> IGNORED, NO forfeit/idle (session kept intact for reconnect)`);
                    return;
                }

                // PLAIN MULTIPLAYER: original cleanup.
                await this.matchservice.leaveQueue(userId);
                if (session?.gameId){
                    const gamestate = await this.gamerepos.findById(session.gameId);
                    if (gamestate?.players[userId]){
                        gamestate.players[userId].status = 'disconnected';
                        await this.gamerepos.update(gamestate);
                        if ('roomId' in gamestate && gamestate.roomId){
                            this.emitter.toRoom(gamestate.roomId, 'player_left', {
                                playerId: userId,
                                newHostId: '',
                            })
                        }
                    }
                }
                if (session?.roomId){
                    const room = await this.roomservice.leaveRoom(session.roomId, userId);
                    if (room){
                        this.emitter.toRoom(room.roomId, 'player_left', {
                            playerId: userId,
                            newHostId: room.hostId,
                        });
                    }
                }
                await this.sessionService.update(userId, { status: "idle" });
            } catch (e) {
                console.error('[GUARD] onDisconnect cleanup error (server kept alive):', e);
            }
        }, RECONNECT_WINDOW_MS);
        this.disconnectTimers.set(userId, timer);
    }
    

    /**
     * Broadcast the post-answer state (or game-finished payload) for a room.
     * Called both from a normal player answer and from the question-timeout
     * force-advance path. When `lastAnswerUpdate` is undefined we treat it as
     * a timeout and set `timedOut: true` on the emitted event.
     */
    async handlePostAnswer(
        gamestate: GameState,
        opts?: {
            lastAnswerUpdate?: { playerId: string; isCorrect: boolean; correctAnswerIndex: number; correctText: string };
            timedOut?: boolean;
        },
    ): Promise<void> {
        if (!('roomId' in gamestate) || !gamestate.roomId) return;
        const roomId = gamestate.roomId;
        const gameId = gamestate.gameId;
        const lastAnswerUpdate = opts?.lastAnswerUpdate;
        const timedOut = !!opts?.timedOut;
        const response = this.mapper.toUpdateResponse(gamestate, lastAnswerUpdate);

        // Push a live snapshot to the tournament room so eliminated players can
        // spectate the ongoing match (scoreboard + question progress). Players
        // actively in the game ignore it (their page doesn't listen for it).
        const tournamentId = (gamestate as any).tournamentId as string | undefined;
        if (tournamentId) {
            this.io.to(`tournament:${tournamentId}`).emit('spectator_update', {
                tournamentId,
                gameId,
                status: gamestate.isFinished ? 'finished' : 'playing',
                currentQuestionIndex: response.state.currentQuestionIndex,
                totalQuestions: response.state.totalQuestions,
                question: gamestate.isFinished ? null : response.nextQuestion,
                players: response.state.player,
            });
        }

        if (gamestate.isFinished) {
            this.io.to(roomId).emit('answer_result', {
                gameId,
                status: 'finished',
                totalQuestions: response.state.totalQuestions,
                currentQuestionIndex: response.state.currentQuestionIndex,
                lastAnswerUpdate,
                timedOut,
                nextQuestion: null,
                players: response.state.player,
                finalScore: response.finalScore,
            });
            this.io.to(roomId).emit('game_finished', {
                gameId,
                state: response,
            });
            this.questionTimer.cancel(gameId);

            if (tournamentId) {
                console.log(`[JUMP] gamehandler GAME FINISHED (normal) t=${tournamentId.slice(0, 8)} game=${gameId.slice(0, 8)} room=${roomId.slice(0, 8)} timedOut=${timedOut} players=[${Object.keys(gamestate.players).join(',')}] winner=${response.finalScore?.winnerId ?? '-'} -> reset BOTH to in_tournament, then onMatchFinished`);
                // Send BOTH players back to the bracket FIRST. onMatchFinished may
                // promote the winner into the next match (createMatchRooms sets a
                // fresh 'matched' + roomId session); doing this reset afterwards
                // would clobber that promotion and strand the winner as 'in_tournament'
                // with no room. Order matters: reset -> advance.
                await Promise.all(
                    Object.keys(gamestate.players).map(p =>
                        this.sessionService.update(p, {
                            status: 'in_tournament',
                            gameId: undefined,
                            roomId: undefined,
                        })
                    )
                );
                const winnerId = response.finalScore?.winnerId ?? '';
                if (winnerId) {
                    const stats = Object.values(gamestate.players).map(p => ({
                        userId: p.id,
                        correctAnswers: p.answers.filter(a => a.isCorrect).length,
                        totalTime: p.Totaltime || 0,
                    }));
                    await this.tournamentService.onMatchFinished(tournamentId, gameId, winnerId, stats);
                } else {
                    console.log(`[JUMP] gamehandler GAME FINISHED but NO winnerId (draw?) game=${gameId.slice(0, 8)} — onMatchFinished NOT called, match stays unresolved`);
                }
            } else {
                await Promise.all(
                    Object.keys(gamestate.players).map(p =>
                        this.sessionService.update(p, { status: 'idle' })
                    )
                );
            }
            await this.gameService.finalize(gameId);
            return;
        }

        this.io.to(roomId).emit('answer_result', {
            gameId,
            status: 'playing',
            totalQuestions: response.state.totalQuestions,
            currentQuestionIndex: response.state.currentQuestionIndex,
            lastAnswerUpdate,
            timedOut,
            nextQuestion: response.nextQuestion,
            players: response.state.player,
            finalScore: null,
        });
        // game continues — arm the deadline for the (possibly new) current question
        // [TEST timedOut OFF] désactivé pour diagnostic — réactiver pour remettre le timeout par question
        // await this.questionTimer.schedule(gameId);
    }

    private async onSubmitAnswer(socket: TypedSocket, userId: string, data: Parameters<ClientToServerEvents['submit_answer']>[0], ack?: (response: any) => void): Promise<void> {
        try {
            const { gameId, selectedAnswerIndex } = data;
            
            if (!gameId || selectedAnswerIndex === undefined) {
                socket.emit('error', { message: 'Missing gameId or selectedAnswerIndex' });
                return;
            }

            // Forward the client's questionId as expectedQuestionId: a retry re-sent on
            // reconnect (see the play page's pendingAnswer flush) for a question the
            // server has already advanced past is then safely ignored (ALREADY_PROCESSED)
            // instead of being mis-recorded against the new current question.
            const result = await this.gameService.submitAnswer(gameId, selectedAnswerIndex, userId, data.questionId);
            
            if (!result) {
                socket.emit('error', { message: 'Failed to submit answer' });
                return;
            }

            // Answer was processed successfully, event will be broadcasted by gameService
            socket.emit('answer_submitted', { success: true });
            try { ack?.({ success: true }); } catch {}
            
            const gamestate = await this.gamerepos.findById(gameId);
            if (!gamestate || !('roomId' in gamestate) || !gamestate.roomId)
                return ;
            const lastAnswer = result.lastAnswerUpdate ? {
                ...result.lastAnswerUpdate,
                correctText: result.lastAnswerUpdate.correctText ?? "",
            } : undefined;
            await this.handlePostAnswer(gamestate, { lastAnswerUpdate: lastAnswer });
        } catch (error) {
            console.error('Error submitting answer:', error);
            socket.emit('error', { message: 'Error submitting answer' });
            try { ack?.({ success: false, message: 'Error submitting answer' }); } catch {}
        }
    }
}
