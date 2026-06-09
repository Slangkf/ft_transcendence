import { randomUUID } from 'crypto';
import type { RoomPlayer, Room, CreateRoomParams, JoinRoomParams, RoomStatus } from "./room.types";
import { RoomRepository } from './room.repository';
import { AppError, ErrorCode } from '../error/apperror';

/**
 * @class RoomService
 * handles: 
 * - Room creation
 * - player join/leav operations
 * - ready status management
 * - room status update
 *  
 */
export class RoomService{

    constructor(private roomrepository: RoomRepository)
    {}

    /**
     * @method createRoom
     * @description create a new room and register the host as the first player.
     *  The room is initialized in the "waiting" status
     * @param params 
     * @returns 
     */
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

    /**
     * @method joinRoom
     * @description add a player to an existing room.
     * Validation:
     * - Room must exist
     * - Room must be in waiting state
     * - Room must not be full
     * @param params 
     * @returns Updated room or null if the room was deleted
     */
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

    /**
     * @method leaveRoom
     * @description Update a player's ready status.
     *
     * Uses an atomic repository operation to avoid
     * race conditions when multiple players change
     * readiness simultaneously.
     *
     * @param roomId Room identifier
     * @param playerId Player identifier
     * @param isReady New ready state
     * @returns Ready state result including whether all players are ready
     */
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
        // Atomic flip: two players in the same room ready up almost simultaneously,
        // and a read-modify-write would lose one of the flags (last-writer-wins),
        // stalling the match until the ready deadline forfeits a player.
        const res = await this.roomrepository.setPlayerReadyAtomic(roomId, playerId, isReady);
        if (!res) throw new AppError(
            "Room not exist",
            ErrorCode.ROOM_NOT_AVAILABLE,
        );
        if (!res.ok) throw new AppError(
            "Player not found",
            ErrorCode.PLAYER_NOT_FOUND,
        );
        return { allReady: !!res.allReady, room: res.room!, changed: !!res.changed };
    }

    async deleteRoom(roomId: string): Promise<void>{
        //redis delete the information of the room
        await this.roomrepository.delete(roomId);
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