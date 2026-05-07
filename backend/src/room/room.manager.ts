import { randomUUID } from 'crypto';
import { RoomService } from "./room.service";
import { CreateRoomParams, IRoomEntryStrategy, Room, RoomEntryParams, RoomEntryResult, RoomPlayer } from "./room.types";

export class RoomManager{
    constructor(
        private roomservice: RoomService,
    ){}

    async createRoom(params: CreateRoomParams): Promise<Room>{
        const roomId = randomUUID();

        const hostPlayer: RoomPlayer = {
            id: params.hostId,
            nickname: params.hostNickname,
            isReady: false,
            joinedAt: Date.now(),
        }

        const players = { [params.hostId]: hostPlayer };
        if (params.players) {
            params.players.forEach(p => {
                if (p.userId !== params.hostId) {
                    players[p.userId] = {
                        id: p.userId,
                        nickname: p.nickname,
                        isReady: false,
                        joinedAt: Date.now(),
                    };
                }
            });
        }

        const room: Room = {
            type: params.type,
            roomId,
            hostId: params.hostId,
            players,
            status: 'waiting',
            maxPlayers: params.maxPlayers ?? 2, 
            createdAt: Date.now(),
            sessionId: '',
        }
        //save in redis
       await this.roomservice.createRoom(room);
        return room
    }
    async entry(type: 'game' | 'chat', params: RoomEntryParams): Promise<RoomEntryResult>{
        //const strategy = this.strategies.get(type)!;
        return strategy.entry(params);
    }

    async leave(roomId: string, userId: string){
        return this.roomservice.leaveRoom(roomId, userId);
    }

    async setReady(roomId: string, userId: string, isready: boolean): Promise<{ allReady: boolean; room: Room }>{
        return this.roomservice.setPlayerReady(roomId, userId, isready);
    }

    async getRoom(roomId: string){
        return this.roomservice.getRoom(roomId);
    }

    async updateStatus(room: Room, action: "active" | "closed"){
        room.status = action
        return await this.roomservice.save(room);
    }
}
/***
 *  management of all rooms, how to join a room 
 *  by roomid? random? by queue? 
 *  need to delete?? 
 */