import { AppError, ErrorCode } from "src/error/apperror";
import { RoomService } from "./room.service";
import type{ IRoomEntryStrategy, RoomEntryParams, RoomEntryResult } from "./room.types";


export class GameEntryStrategy implements IRoomEntryStrategy{
    constructor(
        private roomservice: RoomService,
    ){}

    async entry(params: RoomEntryParams): Promise<RoomEntryResult>{
        if (params.targetId){
            const room = await this.roomservice.joinRoom({
                roomId: params.targetId,
                playerId: params.userId,
                playerNickname: params.nickname,
            })
            return {status: "joined", room};
        }
        //if exist pas, create a new
        throw new AppError(
            "Room not found",
            ErrorCode.ROOM_NOT_FOUND
        )
    }
    
    async setReady(roomId: string, userId: string, isready: boolean){
        return this.roomservice.setPlayerReady(roomId, userId, isready);
    }
}
/****
 * in the param for the entry or creation, need the param of maxplayers in a room, it come with the selection of mode of game 
 * 
 * 
 * 
 * 
 * 
 */