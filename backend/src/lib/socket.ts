import {Redis}  from "./redis";
import {Server} from 'socket.io';
import {Server as HttpServer} from 'http';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import cookie from 'cookie';
import { AppError, ErrorCode } from "../error/apperror";
import { ChatSocketEvents, ClientToServerEvents, FriendSocketEvents, ServerToClientEvents } from "../websocket/socket.types";
import { UserPayload } from "../types/express";
dotenv.config();


export function authMiddleware(socket: any, next: any) {
    const rawcookie = socket.handshake.headers.cookie;
    if (!rawcookie){
        return next(new AppError('Unauthorized in socket', ErrorCode.AUTH_UNAUTHORIZED));
    }

    try {
        const parsed = cookie.parse(rawcookie);
        const token = parsed.auth_token;
        if (!token){
            return next(new AppError('Unauthorized token in socket', ErrorCode.AUTH_UNAUTHORIZED));
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
        socket.data.userId = payload.id;
        socket.data.nickname = payload.username;
        next();
    }catch(error){
        next(new AppError('Unauthorized socket', ErrorCode.AUTH_UNAUTHORIZED));
    }

}

export function createSocketServer(httpserver: HttpServer, redis: typeof Redis){
    const io = new Server(httpserver, {
        cors:{ 
            origin: '*', 
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