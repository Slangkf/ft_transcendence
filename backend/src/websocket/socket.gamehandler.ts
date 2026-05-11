import { RedisGameRepository } from "src/game/game.redis.repository";
import { MatchService } from "src/game/multiplayer/match/match.service";
//import { RoomManager } from "src/room/room.manager";
import { GameEmitter } from "./socket.emitter";
import { Namespace, Socket } from "socket.io";
import { Redis, RedisKeys } from "../lib/redis"
import { GameState } from "src/game/game.types";
import { stat } from "fs";
import { RoomService } from "src/room/room.service";

export class GameSocketHandler{
    constructor(
        private io: Namespace,
        private redis: typeof Redis,
        private roomservice: RoomService ,
        private matchservice: MatchService,
        private gamerepos: RedisGameRepository,
        private emitter: GameEmitter,
        private gameService: any
    ){}

    private gameuserkey(userId: string){
        return RedisKeys.socket.gameUser(userId);
    }
    private disconnectkey(userId: string){
        return RedisKeys.socket.disconnect(userId);
    }

    async onConnection(socket: Socket): Promise<void>{
        const userId = socket.data.userId;

        await this.redis.set(this.gameuserkey(userId), socket.id);

        // Register listeners first so they're always bound
        socket.on('disconnect', ()=>this.onDisconnect(socket, userId))
        socket.on('submit_answer', (data) => this.onSubmitAnswer(socket, userId, data))
        socket.on('join_room', (data) => this.onJoinRoom(socket, userId, data))

        const room = await this.roomservice.getRoomByPlayerId(userId);
        if (!room) return;

        socket.join(room.roomId);
        await this.handleReconnect(socket, userId);
    }

    private async onJoinRoom(socket: Socket, userId: string, data: any): Promise<void> {
        try {
            const roomId = data?.roomId;
            if (!roomId) {
                socket.emit('error', { message: 'Missing roomId' });
                return;
            }
            const room = await this.roomservice.getRoom(roomId);
            if (!room || !room.players[userId]) {
                socket.emit('error', { message: 'Not a member of this room' });
                return;
            }
            socket.join(roomId);
            socket.emit('room_joined', { roomId, players: Object.values(room.players) });
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Error joining room' });
        }
    }

    private async handleReconnect(socket: Socket, userId: string): Promise<void>{
        const match = await this.matchservice.getMyMatch(userId);

        if (!match) return ;

        const room = await this.roomservice.getRoom(match.roomId);
        if (!room)  return ;

        socket.join(room.roomId);

        // 只在room是active状态且有sessionId时发送reconnection
        if (room.status === 'active' && room.sessionId){
            const gamestate = await this.gamerepos.findById(room.sessionId);
            if (gamestate){
                socket.emit('reconnection', {
                    roomId: room.roomId,
                    gameId: gamestate.gameId,
                    state: this.buildPublicGameState(gamestate),
                })
            }
        } else if (room.status === 'closed') {
            // 游戏已完成，通知客户端
            socket.emit('game_finished', {
                roomId: room.roomId,
                message: 'Game has finished'
            });
        }
    }

    private async onDisconnect(socket: Socket, userId: string): Promise<void>{
        await this.redis.del(this.gameuserkey(userId));

        // 给 60 秒重连窗口，超时才真正处理离开逻辑
        await this.redis.set(this.disconnectkey(userId), '1', {EX: 60});

        setTimeout(async () => {
            const stillDisconnected = await this.redis.get(this.disconnectkey(userId));
            if (!stillDisconnected) return; // 已重连，不处理

            await this.matchservice.leaveQueue(userId);

            const match = await this.matchservice.getMyMatch(userId);
            if (match) {
                const room = await this.roomservice.leaveRoom(match.roomId, userId);
                if (room) {
                    this.emitter.toRoom(room.roomId, 'player_left', {
                        playerId: userId,
                        newHostId: room.hostId,
                    });
                }
            }
        }, 60_000);
    }
    

    private async onSubmitAnswer(socket: Socket, userId: string, data: any): Promise<void> {
        try {
            const { gameId, answerIndex } = data;
            
            if (!gameId || answerIndex === undefined) {
                socket.emit('error', { message: 'Missing gameId or answerIndex' });
                return;
            }

            const result = await this.gameService.submitAnswer(gameId, answerIndex, userId);
            
            if (!result) {
                socket.emit('error', { message: 'Failed to submit answer' });
                return;
            }

            // Answer was processed successfully, event will be broadcasted by gameService
            socket.emit('answer_submitted', { success: true });
            
        } catch (error) {
            console.error('Error submitting answer:', error);
            socket.emit('error', { message: 'Error submitting answer' });
        }
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