import {Redis}  from "./redis";
import {Server} from 'socket.io';
import {Server as HttpServer} from 'http';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AppError, ErrorCode } from "src/error/apperror";
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
    io.of('/game').use(authMiddleware);
    io.of('/chat').use(authMiddleware);
    io.of('/friendship').use(authMiddleware);
    return io;
}