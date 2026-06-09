// socket.emitter.ts
import type { ServerToClientEvents, FriendSocketEvents, ChatSocketEvents } from "./socket.types";
import { Namespace, Server } from 'socket.io';
import { Redis, RedisKeys } from '../lib/redis';

export interface IEmitter<TEvents extends Record<string, (...args: any[]) => void>> {
    toUser<K extends keyof TEvents>(
        userId: string,
        event: K,
        data: Parameters<TEvents[K]>[0]
    ): Promise<void>;
    toRoom<K extends keyof TEvents>(
        roomId: string,
        event: K,
        data: Parameters<TEvents[K]>[0]
    ): void;
}

class BaseSocketEmitter<TEvents extends Record<string, (...args: any[]) => void>> implements IEmitter<TEvents> {
    constructor(
        protected ns: Namespace,
        protected redis: typeof Redis,
        protected userkey: (userId: string) => string,
    ) {}

    async toUser<K extends keyof TEvents>(
        userId: string,
        event: K,
        data: Parameters<TEvents[K]>[0]
    ): Promise<void> {
        const socketId = await this.redis.get(this.userkey(userId));
        if (socketId) {
            this.ns.to(socketId).emit(String(event), data);
        }
    }

    toRoom<K extends keyof TEvents>(
        roomId: string,
        event: K,
        data: Parameters<TEvents[K]>[0]
    ): void {
        this.ns.to(roomId).emit(String(event), data);
    }
}

export class GameEmitter extends BaseSocketEmitter<ServerToClientEvents> {
    constructor(io: Server, redis: typeof Redis) {
        super(io.of('/game'), redis, RedisKeys.socket.gameUser);
    }

    // Deliver to ALL of a user's /game sockets via the per-user room (every socket
    // joins `user:<id>` in onConnection), instead of a single volatile socketId
    // pointer that a second tab / reconnect would steal. Multi-tab safe and immune
    // to pointer churn — so a targeted event (matched / next_match_ready / …) is no
    // longer silently lost when the pointer is stale.
    async toUser<K extends keyof ServerToClientEvents>(
        userId: string,
        event: K,
        data: Parameters<ServerToClientEvents[K]>[0]
    ): Promise<void> {
        this.ns.to(`user:${userId}`).emit(String(event), data);
    }
}

export class FriendEmitter extends BaseSocketEmitter<FriendSocketEvents> {
    constructor(io: Server, redis: typeof Redis) {
        super(io.of('/friendship'), redis, RedisKeys.socket.friendUser);
    }
}

export class ChatEmitter extends BaseSocketEmitter<ChatSocketEvents> {
    constructor(io: Server, redis: typeof Redis) {
        super(io.of('/chat'), redis, RedisKeys.socket.chatUser);
    }
}
