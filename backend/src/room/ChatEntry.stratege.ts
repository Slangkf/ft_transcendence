import { AppError, ErrorCode } from "src/error/apperror";
import { RoomService } from "./room.service";
import { IRoomEntryStrategies, RoomEntryParams, RoomEntryResult } from "./room.types";


export class ChatEntryStrategy implements IRoomEntryStrategies{
    constructor(private roomservice: RoomService){}

    async entry(params: RoomEntryParams): Promise<RoomEntryResult> {
        if (!params.targetId) throw new AppError("UserId required", ErrorCode.BAD_REQUEST);

        const existRoomId = await this.roomservice.findroomforfriends();
        if (existRoomId){
            const room = await this.roomservice.getRoom(existRoomId);
            return {status: "joined", room: room!}
        }

        const room = await this.roomservice.createRoom({
            hostId: params.userId,
            hostNickname: params.nickname,
        })
        return {status: "joined", room}
    }
}