import { redis } from "src/lib/redis";

const ROOM_TTL = 60 * 60 *1;

export class RoomRepository{
    async getroom(roomId: string): Promise<Room>{

    }

    async getPlayer(roomId: string): {

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