import {Redis}  from "./redis";
import {Server} from 'socket.io';
import {Server as HttpServer} from 'http';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AppError, ErrorCode } from "src/error/apperror";
import { ChatSocketEvents, ClientToServerEvents, FriendSocketEvents, ServerToClientEvents } from "src/websocket/socket.types";
dotenv.config();


export function authMiddleware(socket: any, next: any) {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new AppError('Unauthorized in socket', ErrorCode.AUTH_UNAUTHORIZED));
    }
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET) as any;
        socket.data.userId = payload.id;
        socket.data.nickname = payload.username;
        next();
    } catch (error) {
        next(new AppError('Unauthorized in socket', ErrorCode.AUTH_UNAUTHORIZED));
    }
}

export function createSocketServer(httpserver: HttpServer, redis: Redis){
    const io = new Server(httpserver, {
        cors:{ 
            origin: 'https://localhost:8888', 
            credentials: true,
            methods:['GET', 'POST']},
    })

    const gameNs = io.of('/game').use(authMiddleware) as unknown as 
            import ('socket.io').Namespace<ClientToServerEvents, ServerToClientEvents>;

    const chatNs = io.of('/chat').use(authMiddleware) as unknown as 
            import ('socket.io').Namespace<Record<string, never>, ChatSocketEvents>;
    
    const friendNs = io.of('/friendship').use(authMiddleware) as unknown as 
            import ('socket.io').Namespace<Record<string, never>, FriendSocketEvents>;
    
    return {io, gameNs, chatNs, friendNs};
}