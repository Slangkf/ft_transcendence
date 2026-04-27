import { redis } from "src/lib/redis";
import { Room } from "./room.types";

const ROOM_TTL = 60 * 60 *1;

export class RoomRepository{
    private getKey(roomId: string){
        return `room:${roomId}`
    }

    async getroom(roomId: string): Promise<Room | null>{
        const data = await redis.get(this.getKey(roomId));
        if (!data) return null;
    
        return JSON.parse(data);
    }
    async save(room: Room): Promise<void>{
        await redis.set(
            this.getKey(room.roomId),
            JSON.stringify(room),
            ROOM_TTL
        )
    }

    async update(room: Room): Promise<void>{
        await redis.set(
            this.getKey(room.roomId),
            JSON.stringify(room),
            ROOM_TTL
        )
    }
    async delete(roomId: string): Promise<void> {
        await redis.del(this.getKey(roomId));
    }

}

/***
 *  1. save the information of room in redis
 *  2. get a Room from redis, prepare for service to join a room
 *  3. delete in redis when a game finish
 *  4. need update? update information of players in a game 
 *  5. 
 * 
 */