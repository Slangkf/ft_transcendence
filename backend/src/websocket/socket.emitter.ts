import type { SocketEvent } from "./socket.types";
import { Server } from 'socket.io';
import { Redis } from 'ioredis';

export interface IEmitter {
    toUser<K extends keyof SocketEvent>(
        userId: string,
        event: K,
        data: SocketEvent[K]
    ): Promise<void>;

    toRoom<K extends keyof SocketEvent>(
        roomId: string,
        event: K,
        data: SocketEvent[K]
    ): void;
}

export class SocketEmitter implements IEmitter{
    constructor(
        private io: Server,
        private redis: Redis,
    ){}

    async toUser<K extends keyof SocketEvent>(
        userId: string,
        event: K,
        data: SocketEvent[K]
    ): Promise<void>{
        const socketId = await this.redis.get(`socketId:${userId}`)
        if (socketId){
            this.io.to(socketId).emit(event, data);
        }
    }

    toRoom<K extends keyof SocketEvent>(
        roomId: string,
        event: K,
        data: SocketEvent[K]
    ){
        this.io.to(roomId).emit(event, data)
    }
}