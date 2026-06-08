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
import { prisma } from "./prisma";
dotenv.config();

/**
 * Socket.IO authentication middleware
 * 
 * validates the JWT stored in the auth_token cookie
 * during the Websocket process
 * 
 * On success:
 * - Retrieves the user from the database
 * - Stores user information in socket.data
 *
 * On failure:
 * - Rejects the socket connection
 * @param socket 
 * @param next 
 */
export async function authMiddleware(socket: any, next: any) {
    //Retrieve cookies sent during the WebSocket handshake.
    const rawcookie = socket.handshake.headers.cookie;
    if (!rawcookie){
        return next(new AppError('Unauthorized in socket', ErrorCode.AUTH_UNAUTHORIZED));
    }

    try {
        //extract the authentication token from the auth_token cookie
        const parsed = cookie.parse(rawcookie);
        const token = parsed.auth_token;
        if (!token){
            return next(new AppError('Unauthorized token in socket', ErrorCode.AUTH_UNAUTHORIZED));
        }
        //verify jwt signature and decode payload 
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
        //get user from database and update the username 
        const user = await prisma.user.findUnique({
            where: {id: Number(payload.id)},
            select: {id: true, username: true}
        })
        if (!user){
            throw  new AppError("User not found in middleware socket", ErrorCode.USER_NOT_FOUND)
        }

        //store authenticated user information in the socket context
        socket.data.userId = String(payload.id);
        socket.data.nickname = user.username;
        next();
    }catch(error){
        next(new AppError('Unauthorized socket', ErrorCode.AUTH_UNAUTHORIZED));
    }

}

/**
 * Socket.IO Configuration
 *
 * - create and configure the socket.io server
 * - initialize all application namespaces and applies authentication middleware 
 *
 * Namespaces:
 * - /game       : Multiplayer game events
 * - /chat       : Real-time chat events
 * - /friendship : Friend request and presence events
 */
export function createSocketServer(httpserver: HttpServer, redis: typeof Redis){
    //create the root socket.io server with CORS support 
    const io = new Server(httpserver, {
        cors:{ 
            origin: true, 
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


/**
 * Security Note:
 * WebSocket connections reuse the same authentication
 * cookie as HTTP requests, ensuring a single
 * authentication mechanism across the application.
 */