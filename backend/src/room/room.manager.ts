import { RoomService } from "./room.service";

export class RoomManager{
    constructor(
        private roomservice: RoomService,
        
    ){}
    async getroomByUser(userId: string): Promise<Room | null>{
        
    }
}
/***
 *  management of all rooms, how to join a room 
 *  by roomid? random? by queue? 
 */