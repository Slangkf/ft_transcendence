import { execArgv } from "process";
import type { GameSocketEvents, FriendSocketEvents, ChatSocketEvents } from "./socket.types";
import { Namespace, Server } from 'socket.io';
import { Redis, RedisKeys } from 'src/lib/redis';

export interface IEmitter<TEvents> {
    toUser<K extends keyof TEvents>(
        userId: string,
        event: K,
        data: TEvents[K]
    ): Promise<void>;

    toRoom<K extends keyof TEvents>(
        roomId: string,
        event: K,
        data: TEvents[K]
    ): void;
}

class BaseSocketEmitter<TEvents> implements IEmitter<TEvents>{
    constructor(
        protected ns: Namespace,
        protected redis: typeof Redis,
        protected userkey: (userId: string)=> string,
    ){}

    async toUser<K extends keyof TEvents>(userId: string, event: K, data: TEvents[K]): Promise<void>{
        const socketId = await this.redis.get(this.userkey(userId));

        if (socketId){
            this.ns.to(socketId).emit(String(event), data);
        }
    }

    toRoom<K extends keyof TEvents>(roomId: string, event: K, data: TEvents[K]): void {
        this.ns.to(roomId).emit(String(event), data);
    }

}

export class GameEmitter extends BaseSocketEmitter<GameSocketEvents>{
    constructor(io: Server, redis: typeof Redis){
        super(io.of('/game'), redis, RedisKeys.socket.gameUser);
    }
}

export class FriendEmitter extends BaseSocketEmitter<FriendSocketEvents>{
    constructor(io: Server, redis: typeof Redis){
        super(io.of('/friendship'), redis, RedisKeys.socket.friendUser);
    }
}

export class ChatEmitter extends BaseSocketEmitter<ChatSocketEvents>{
constructor(io: Server, redis: typeof Redis){
    super(io.of('/chat'), redis, RedisKeys.socket.chatUser);
}
}
