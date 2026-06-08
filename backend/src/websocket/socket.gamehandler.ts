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

    async onConnection(socket: TypedSocket): Promise<void>{
        const userId = socket.data.userId;

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
                    socket.emit('game_finished', {
                        gameId: gamestate.gameId,
                        state: this.mapper.toUpdateResponse(gamestate),
                    });
                    break;
                } else {
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
                    await this.sessionService.update(userId, { status: "idle", tournamentId: undefined });
                    socket.emit('session_reconnect', {type: "idle"});
                    break;
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

        // Only the user's *current* socket may run disconnect cleanup. On a remote
        // network blip, socket.io reconnects with a fresh socket.id before the server
        // detects the old socket dropped (ping timeout). The stale socket's disconnect
        // must NOT delete the new socket's gameUser mapping nor schedule a forfeit
        // while the player is still connected (and possibly mid-game).
        const current = await this.redis.get(this.gameuserkey(userId));
        if (current && current !== socket.id) return;

        if (current === socket.id) {
            await this.redis.del(this.gameuserkey(userId));
        }
        // 给 60 秒重连窗口，超时才真正处理离开逻辑
        const RECONNECT_WINDOW_MS = 60_000;
        await this.redis.set(this.disconnectkey(userId), '1', {EX: RECONNECT_WINDOW_MS / 1000});

        const timer =setTimeout(async () => {
			this.disconnectTimers.delete(userId);
            const stillDisconnected = await this.redis.get(this.disconnectkey(userId));
            if (!stillDisconnected) return; // 已重连，不处理

            // 真正离开：从队列和房间里清理
            await this.matchservice.leaveQueue(userId);

            const session = await this.sessionService.get(userId);
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
            // tournament forfeit: if the user was part of a tournament, forfeit their current match
            if (session?.tournamentId) {
                try {
                    await this.tournamentService.forfeit(session.tournamentId, userId);
                } catch (e) {
                    console.error("tournament forfeit error:", e);
                }
            }
            if (session?.roomId){
                try{
                    const room = await this.roomservice.leaveRoom(session.roomId, userId);
                    if (room){
                        this.emitter.toRoom(room.roomId, 'player_left', {
                            playerId: userId,
                            newHostId: room.hostId,
                        });
                    }
                }catch (error){
                    console.error("Error leaving room on disconnect:", error);
                }
            }
            await this.sessionService.update(userId, {
                status: "idle"});
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
            lastAnswerUpdate,
            timedOut,
            nextQuestion: response.nextQuestion,
            players: response.state.player,
            finalScore: null,
        });
        // game continues — arm the deadline for the (possibly new) current question
        await this.questionTimer.schedule(gameId);
    }

    private async onSubmitAnswer(socket: TypedSocket, userId: string, data: Parameters<ClientToServerEvents['submit_answer']>[0], ack?: (response: any) => void): Promise<void> {
        try {
            const { gameId, selectedAnswerIndex } = data;
            
            if (!gameId || selectedAnswerIndex === undefined) {
                socket.emit('error', { message: 'Missing gameId or selectedAnswerIndex' });
                return;
            }

            const result = await this.gameService.submitAnswer(gameId, selectedAnswerIndex, userId);
            
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
