import {Redis}  from "./redis";
import {Server} from 'socket.io';
import {Server as HttpServer} from 'http';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AppError, ErrorCode } from "src/error/apperror";
dotenv.config();


export function createSocketServer(httpserver: HttpServer, redis: Redis){
    const io = new Server(httpserver, {
        cors:{ origin: 'https://localhost:8888', credentials: true},
    })

    io.use(async(socket, next)=> {
        try{
            const token = socket.handshake.auth.token;
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            socket.data.userId = payload.userId;
            socket.data.nickname = payload.nickname;
            next();
        }catch(error){
            next(new AppError('Unauthorized in socket', ErrorCode.AUTH_UNAUTHORIZED));
        }
    })
    return io;
}