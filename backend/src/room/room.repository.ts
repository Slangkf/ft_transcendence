import { Redis, RedisKeys } from "src/lib/redis";
import { Room } from "./room.types";

const ROOM_TTL = 60 * 60 *1;

export class RoomRepository{
    private getKey(roomId: string){
        return RedisKeys.game.room(roomId);
    }

    async getroom(roomId: string): Promise<Room | null>{
        const data = await Redis.get(this.getKey(roomId));
        if (!data) return null;
    
        return JSON.parse(data);
    }
    async save(room: Room): Promise<void>{
        await Redis.set(
            this.getKey(room.roomId),
            JSON.stringify(room),
            {EX: ROOM_TTL}
        )
    }

    async update(room: Room): Promise<void>{
        await Redis.set(
            this.getKey(room.roomId),
            JSON.stringify(room),
            {EX: ROOM_TTL}
        )
    }
    async delete(roomId: string): Promise<void> {
        await Redis.del(this.getKey(roomId));
    }
    async getRoomByPlayerId(playerId: string): Promise<Room | null>{
        const pattern = this.getKey('*');

        for await (const keyOrKeys of Redis.scanIterator({
            MATCH: pattern,
            COUNT: 100,
        })) {
            const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
            for (const key of keys) {
                const data = await Redis.get(key);
                if (!data) continue;

                const room: Room = JSON.parse(data);
                if (room.players[playerId]) {
                    return room;
                }
            }
        }

        return null;
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