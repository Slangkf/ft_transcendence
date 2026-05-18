import { randomUUID } from 'crypto';
import type { RoomPlayer, Room, CreateRoomParams, JoinRoomParams, RoomStatus } from "./room.types";
import { RoomRepository } from './room.repository';
import { AppError, ErrorCode } from '../error/apperror';


export class RoomService{

    constructor(private roomrepository: RoomRepository)
    {}

    async createRoom(params: CreateRoomParams): Promise<Room>{
        const roomId = randomUUID();

        const hostPlayer: RoomPlayer = {
            userId: params.hostId,
            nickname: params.hostNickname,
            isReady: false,
            joinedAt: Date.now(),
        }

        const players = { [params.hostId]: hostPlayer };
        if (params.players) {
            params.players.forEach(p => {
                if (p.userId !== params.hostId) {
                    players[p.userId] = {
                        userId: p.userId,
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
            tournamentId: params.tournamentId,
        }
        //save in redis
        await this.roomrepository.save(room);
        return room
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
        if (Object.keys(room.players).length >= room.maxPlayers) throw new AppError(
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
            userId: params.playerId,
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
            room.hostId = remainPlayers[0];
        }
        
        delete room.players[playerId];

        await this.roomrepository.update(room);
        return room;
    }

    async setPlayerReady(roomId: string, playerId: string, isReady: boolean): Promise<{ allReady: boolean; room: Room; changed: boolean }>{
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
        const allReadyNow = () => Object.values(room.players).every(p => p.isReady);

        // ignore ready toggles once the game is starting/running (prevents the lobby state from
        // bouncing on repeated clicks after everyone is already ready)
        if (room.status !== 'waiting' || player.isReady === isReady){
            return { allReady: allReadyNow(), room, changed: false };
        }
        //2. update the status of player
        player.isReady = isReady;
        //3. check if everyone is ready
        const allready = allReadyNow();
        if (allready){
            room.status = 'starting';
        }

        await this.roomrepository.update(room);
        return { allReady: allready, room, changed: true };
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

    async updateStatus(room: Room, status: RoomStatus): Promise<void>{
        room.status = status;
        return await this.roomrepository.update(room);
    }
    
    async getRoomByPlayerId(playerId: string): Promise<Room | null>{
        return await this.roomrepository.getRoomByPlayerId(playerId);
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