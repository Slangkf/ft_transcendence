import { RedisGameRepository } from "src/game/game.redis.repository";
import { MatchService } from "src/game/multiplayer/match/match.service";
import { RoomManager } from "src/room/room.manager";
import { SocketEmitter } from "./socket.emitter";
import { Socket } from "socket.io";
import { Redis, RedisKeys } from "../lib/redis"
import { GameState } from "src/game/game.types";
import { stat } from "fs";





export class SocketHandler{
    constructor(
        private redis: Redis,
        private roommanager: RoomManager,
        private matchservice: MatchService,
        private gamerepos: RedisGameRepository,
        private emitter: SocketEmitter
    ){}

    private userkey(userId: string){
        return RedisKeys.socket.user(userId);
    }
    private disconnectkey(userId: string){
        return RedisKeys.socket.disconnect(userId);
    }

    async onConnection(socket: Socket): Promise<void>{
        const userId = socket.data.userId;

        // save in redis 
        await this.redis.set(this.userkey(userId), socket.id);

        await this.handleReconnect(socket, userId);

        socket.on('disconnect', ()=>this.onDisconnect(socket, userId))
    }

    private async handleReconnect(socket: Socket, userId: string): Promise<void>{
        const match = await this.matchservice.getMyMatch(userId);

        if (!match) return ;

        const room = await this.roommanager.getRoom(match.roomId);
        if (!room)  return ;

        socket.join(room.roomId);

        if (room.status === 'active' && room.sessionId){
            const gamestate = await this.gamerepos.findById(room.sessionId);
            if (gamestate){
                socket.emit('reconnection', {
                    roomId: room.roomId,
                    gameId: gamestate.gameId,
                    state: this.buildPublicGameState(gamestate),
                })
            }
        }
    }

    private async onDisconnect(socket: Socket, userId: string): Promise<void>{
        await this.redis.del(this.userkey(userId));

        // 给 60 秒重连窗口，超时才真正处理离开逻辑
        await this.redis.set(this.disconnectkey(userId), '1', {EX: 60});

        setTimeout(async () => {
            const stillDisconnected = await this.redis.get(this.disconnectkey(userId));
            if (!stillDisconnected) return; // 已重连，不处理

            // 真正离开：从队列和房间里清理
            await this.matchservice.leaveQueue(userId);

            const match = await this.matchservice.getMyMatch(userId);
            if (match) {
                const room = await this.roommanager.leave(match.roomId, userId);
                if (room) {
                    this.emitter.toRoom(room.roomId, 'player_left', {
                        playerId: userId,
                        newHostId: room.hostId,
                    });
                }
            }
        }, 60_000);
    }
    


    private buildPublicGameState(gamestate: GameState){
        return {
            gameId: gamestate.gameId,
            currentQuestionIndex: gamestate.currentQuestionIndex,
            isFinished: gamestate.isFinished,
            totalQuestions: gamestate.questions.length,
            players: Object.values(gamestate.players).map( p =>({
                id: p.id,
                score: p.score,
                status: p.status,
            }))
        }
    }
}