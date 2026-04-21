import { randomUUID } from 'crypto';
import type { Room, RoomPlayer, CreateRoomParams, JoinRoomParams } from "./room.types";
import { RoomRepository } from './room.repository';


export class RoomService{
    private roomrepository: RoomRepository;

    constructor(){
        this.roomrepository = new RoomRepository();
    }

    async createRoom(params: CreateRoomParams): Promise<Room>{
        const roomId = await randomUUID();

        const hostPlayer: RoomPlayer = {
            id: params.hostId,
            nickname: params.hostNickname,
            isReady: true,
            joinedAt: new Date(),
        }

        const room = {
            roomId,
            hostId: params.hostId,
            players: {
                [params.hostId]: hostPlayer,
            },
            maxPlayers: params.maxPlayers || 5,
            status: 'waiting',
            createdAt: new Date(),
            gameId: '',
        }
        //save in redis
        
        return room
    }

    async jointRoom(params: JoinRoomParams): Promise<Room>{
        //1. check the status of the room

        //2. 
    }
}


/****
 * room: 
 *      use for >= 2 players
 *      1. create a room
 *      2. join a room before the game start only (refuse the connection since the game start)
 *      3. leave a room (traitement of host in the room)
 *      4. 
 */