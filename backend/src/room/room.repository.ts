import { Redis, RedisKeys } from "../lib/redis";
import { Room } from "./room.types";

const ROOM_TTL = 60 * 60 *1;

export class RoomRepository{
    private getKey(roomId: string){
        return RedisKeys.game.room(roomId);
    }

    /* Reads a room from Redis by id, or null if absent. */
    async getroom(roomId: string): Promise<Room | null>{
        const data = await Redis.get(this.getKey(roomId));
        if (!data) return null;

        return JSON.parse(data);
    }
    /* Writes a room to Redis with the room TTL (initial create). */
    async save(room: Room): Promise<void>{
        await Redis.set(
            this.getKey(room.roomId),
            JSON.stringify(room),
            {EX: ROOM_TTL}
        )
    }

    /* Overwrites an existing room in Redis (refreshing the room TTL). */
    async update(room: Room): Promise<void>{
        await Redis.set(
            this.getKey(room.roomId),
            JSON.stringify(room),
            {EX: ROOM_TTL}
        )
    }
    /* Deletes a room from Redis by id. */
    async delete(roomId: string): Promise<void> {
        await Redis.del(this.getKey(roomId));
    }

    /**
     * Atomically flip a player's `isReady` flag and recompute readiness.
     * Two players in the same room click "Ready" at almost the same instant
     * (next_match_ready fans out to everyone together). A read-modify-write would
     * let the second writer overwrite the first one's flag (last-writer-wins),
     * so `allReady` is never detected and the match stalls until the ready
     * deadline forfeits a player. A Lua script makes the whole flip atomic.
     *
     * Returns null when the room no longer exists. Otherwise:
     *   { ok: false }                       -> player not in room
     *   { ok: true, changed, allReady, room } -> applied (changed=false on no-op
     *                                            or once the room left 'waiting')
     */
    async setPlayerReadyAtomic(roomId: string, playerId: string, isReady: boolean):
        Promise<{ ok: boolean; changed?: boolean; allReady?: boolean; room?: Room } | null> {
        const script = `
            local data = redis.call('get', KEYS[1])
            if not data then return nil end

            local room = cjson.decode(data)
            local playerId = ARGV[1]
            local isReady = (ARGV[2] == 'true')

            local player = room.players[playerId]
            if not player then
                return cjson.encode({ ok = false })
            end

            local function allReady()
                for _, p in pairs(room.players) do
                    if not p.isReady then return false end
                end
                return true
            end

            -- ignore toggles once the game is starting/running, and no-op repeats
            if room.status ~= 'waiting' or player.isReady == isReady then
                return cjson.encode({ ok = true, changed = false, allReady = allReady(), room = room })
            end

            player.isReady = isReady
            room.players[playerId] = player
            local ar = allReady()
            if ar then room.status = 'starting' end

            local ttl = redis.call('TTL', KEYS[1])
            if ttl <= 0 then ttl = 3600 end
            redis.call('SET', KEYS[1], cjson.encode(room), 'EX', ttl)

            return cjson.encode({ ok = true, changed = true, allReady = ar, room = room })
        `;
        const result = await Redis.eval(script, {
            keys: [this.getKey(roomId)],
            arguments: [String(playerId), isReady ? 'true' : 'false'],
        });
        return result ? JSON.parse(result as string) : null;
    }
    /* Scans every room key in Redis to find the one containing this player, or null. */
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