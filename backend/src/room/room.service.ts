import { randomUUID } from 'crypto';
import type { RoomPlayer, Room, CreateRoomParams, JoinRoomParams } from "./room.types";
import { RoomRepository } from './room.repository';
import { AppError, ErrorCode } from 'src/error/apperror';


export class RoomService{
    private roomrepository: RoomRepository;

    constructor(){
        this.roomrepository = new RoomRepository();
    }

    async createRoom(room: Room): Promise<void>{
        await this.roomrepository.save(room);
    }
    async joinRoom(params: JoinRoomParams): Promise<Room>{
        //1. check the status of the room
        const room = await this.roomrepository.getroom(params.roomId);

        if (!room)  throw new AppError(
            "Room not exist", 
            ErrorCode.ROOM_NOT_FOUND,
            404
        );
        //2. check the status of a room, refuse when it is ingame or finished
        if (room.status !== 'waiting') throw new AppError(
            "Room status is not waiting",
            ErrorCode.ROOM_NOT_AVAILABLE,
            409
        );
        //3. when it starts, check nombre of players in the room, >= 2 && <4 ok 
        if (Object.keys(room.players).length >= 2) throw new AppError(
            "Room is full",
            ErrorCode.ROOM_FULL,
            409
        )
        if (room.players[params.playerId]) {
            room.players[params.playerId] = {
                ...room.players[params.playerId],
                nickname: params.playerNickname,
                joinedAt: Date.now()
            }
            await this.roomrepository.update(room);
            return room;
        }

        const newplayer: RoomPlayer = {
            id: params.playerId,
            nickname: params.playerNickname,
            isReady: false,
            joinedAt: Date.now(),
        }
        room.players[params.playerId] = newplayer;
        await this.roomrepository.update(room);
        
        return room
    }

    async leaveRoom(roomId: string, playerId: string): Promise<Room | null>{
        const room = await this.roomrepository.getroom(roomId);
        if (!room)  throw new AppError(
            "Room not exist", 
            ErrorCode.ROOM_NOT_AVAILABLE,
        );
        // check the nombre of players in the room after, if ===0 delete
        const remainPlayers = Object.keys(room.players).filter(id => id !== playerId);
        if (remainPlayers.length === 0){
            //redis delete the room
            await this.roomrepository.delete(room.roomId);
            return null;
        }
        //if the player is the host: change the host of room
        if (room.hostId === playerId){
            const newhost = remainPlayers[0];
        }
        await this.roomrepository.update(room);
        return await this.roomrepository.getroom(roomId);
    }

    async setPlayerReady(roomId: string, playerId: string, isReady: boolean): Promise<{ allReady: boolean; room: Room }>{
        //1. get the player in redis
        const room = await this.roomrepository.getroom(roomId);
        if (!room)  throw new AppError(
            "Room not exist", 
            ErrorCode.ROOM_NOT_AVAILABLE,
        );
        const player = room.players[playerId];
        if (!player) throw new AppError(
            "Player not found",
            ErrorCode.PLAYER_NOT_FOUND,
        )
        //2. update the status of player
        player.isReady = isReady;
        //3. check if everyone is ready
        const allPlayers = Object.values(room.players);
        const allready = allPlayers.every(p => p.isReady) && allPlayers.length >= room.maxPlayers;
       
        await this.roomrepository.update(room);
        return { allReady: allready, room };
    }

    async deleteRoom(roomId: string): Promise<void>{
        //redis delete the information of the room 
    }
    async getRoom(roomId: string): Promise<Room | null>{
        return await this.roomrepository.getroom(roomId);
    }
    async save(room: Room): Promise<void>{
        return await this.roomrepository.update(room); //????
    }
}


/****
 * room: 
 *      use for >= 2 players
 *      1. create a room
 *      2. join a room before the game start only (refuse the connection since the game start)
 *      3. leave a room (traitement of host in the room)
 *      4. change the status of player， and check if everyone is ready to start the game
 */