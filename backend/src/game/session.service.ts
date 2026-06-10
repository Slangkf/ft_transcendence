import { Redis, RedisKeys } from "../lib/redis";


export class SessionService {
    /* Reads a user's session blob from Redis, or null if none exists. */
    async get(userId: string): Promise<userSession | null>{
        const data = await Redis.get(RedisKeys.session.user(userId));

        return data ? JSON.parse(data) : null;
    }

    /* Writes (overwrites) a user's full session blob in Redis. */
    async set(session: userSession): Promise<void>{
        await Redis.set(RedisKeys.session.user(session.userId), JSON.stringify(session));
    }

    /* Merges a partial update into an existing session (no-op if none), refreshing updatedAt. */
    async update(userId: string, update: Partial<userSession>): Promise<void>{
        const session = await this.get(userId);
        if (!session) return;

        const updatedSession = {...session, ...update, updatedAt: Date.now()};
        await this.set(updatedSession);
    }

    /* Creates a fresh idle session for a user (called on socket connect). */
    async init(userId: string, socketId?: string):Promise<void>{
        await this.set({
            userId, 
            status:"idle",
            socketId,
            updatedAt: Date.now(),
        })
    }
}

export interface userSession {
    userId: string;
    status: 'idle' | 'queue' | 'matched' | 'in_room' | 'in_game' | 'in_tournament';
    socketId?: string;
    matchId?: string;
    roomId?: string;
    gameId?: string;
    tournamentId?: string;
    updatedAt: number;
}