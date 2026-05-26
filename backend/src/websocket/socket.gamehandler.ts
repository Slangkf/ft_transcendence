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
import { GameMapper } from "src/game/game.mapper";
import {SubmitAnswerReq} from "@shared/game.schema";

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
        private mapper: GameMapper,
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
        if (!session) return ;

        const {status} = session;
        if (session.roomId){
            socket.join(session.roomId);
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
            default:
                socket.emit('session_reconnect', {type: "idle"});
        }
    }

    private async onDisconnect(socket: TypedSocket, userId: string): Promise<void>{
        await this.redis.del(this.gameuserkey(userId));

        // 给 60 秒重连窗口，超时才真正处理离开逻辑
        await this.redis.set(this.disconnectkey(userId), '1', {EX: 60});

        const timer =setTimeout(async () => {
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
        }, 60_000);
        this.disconnectTimers.set(userId, timer);
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
            //calcul finalscore
            if (gamestate.isFinished)
            {
                this.io.to(gamestate.roomId).emit('game_finished', {
                    gameId: gamestate.gameId,
                    state: this.mapper.toUpdateResponse(gamestate),
                })
                await this.gameService.cleanupAfterGame(
                    gamestate.roomId,
                    Object.keys(gamestate.players)
                );
                return;
            }
            this.io.to(gamestate.roomId).emit('answer_result', {
                gameId,
                status: result.status,
                lastAnswerUpdate:{
                    ...result.lastAnswerUpdate!,
                    correctText: result.lastAnswerUpdate?.correctText ?? "",
                },
                nextQuestion: result.nextQuestion,
                players: result.state.player,
                finalScore: result.finalScore,
            })
        } catch (error) {
            console.error('Error submitting answer:', error);
            socket.emit('error', { message: 'Error submitting answer' });
            try { ack?.({ success: false, message: 'Error submitting answer' }); } catch {}
        }
    }
}