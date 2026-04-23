import { randomUUID } from 'crypto';
import { ChatEntryStrategy } from "./ChatEntry.stratege";
import { GameEntryStrategy } from "./GameEntry.stratege";
import { RoomService } from "./room.service";
import { CreateRoomParams, IRoomEntryStrategy, Room, RoomEntryParams, RoomEntryResult, RoomPlayer } from "./room.types";

export class RoomManager{
    private strategies: Map<'game'| 'chat', IRoomEntryStrategy>;
    constructor(
        private roomservice: RoomService,
    ){
        this.strategies = new Map([
            ['game', new GameEntryStrategy(this.roomservice)],
            ['chat', new ChatEntryStrategy(this.roomservice)],
        ])
    }
    async createRoom(params: CreateRoomParams): Promise<Room>{
        const roomId = randomUUID();

        const hostPlayer: RoomPlayer = {
            id: params.hostId,
            nickname: params.hostNickname,
            isReady: true,
            joinedAt: Date.now(),
        }

        const players = { [params.hostId]: hostPlayer };
        if (params.players) {
            params.players.forEach(p => {
                if (p.userId !== params.hostId) {
                    players[p.userId] = {
                        id: p.userId,
                        nickname: p.nickname,
                        isReady: true,
                        joinedAt: Date.now(),
                    };
                }
            });
        }

        const room = {
            roomId,
            hostId: params.hostId,
            players,
            status: 'waiting',
            maxPlayers: 2,
            createdAt: Date.now(),
            gameId: '',
        }
        //save in redis
        // await this.roomrepository.
        return room
    }
    async entry(type: 'game' | 'chat', params: RoomEntryParams): Promise<RoomEntryResult>{
        const strategy = this.strategies.get(type)!;
        return strategy.entry(params);
    }

    async leave(roomId: string, userId: string){
        return this.roomservice.leaveRoom(roomId, userId);
    }

    async setReady(roomId: string, userId: string, isready: boolean){
        return this.roomservice.setPlayerReady(roomId, userId, isready);
    }

    async getRoom(roomId: string){
        return this.roomservice.getRoom(roomId);
    }

    async updateStatus(room: Room, action: "in_game"| "starting"| "finished"){
        room.status = action
        return await this.roomservice.save(room);
    }
}
/***
 *  management of all rooms, how to join a room 
 *  by roomid? random? by queue? 
 */