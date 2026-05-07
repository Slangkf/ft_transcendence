import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import {createServer} from 'http';

import { AuthRouter } from './auth/auth.router';
import { UserRouter } from './User/user.router';
import {createGameRouter} from './g/game.router';
import friendshipRouter from './friendship/friendship.router';
import {initRedis, Redis} from './lib/redis';
import {createSocketServer} from './lib/socket';
import {FriendEmitter, GameEmitter} from './websocket/socket.emitter';
import { createGameServices,
  roomService,
  matchService,
  gamerepo,
  createFriendshipService,
  userrepo,
} from './container';
import { GameSocketHandler } from './websocket/socket.gamehandler';
import { FriendSocketHandler } from './websocket/socket.FriendHandler';
import { sign } from 'crypto';
import { SessionService } from './game/session.service';


const app = express();
const PORT = 3000;



// ====== INIT FUNCTION ======
const start = async () => {
  try {
    app.get('/health', (req, res) => res.json({ok: true}))
    await initRedis();
    // 2. Express setup
    app.use(cookieParser());
    app.use(express.json());
    app.use(cors({
      origin: 'https://localhost:8888', // must match the Origin header sent by the browser (protocol + host + port)
      credentials: true
    }));
    app.use('/uploads', express.static('uploads'));

    //httpserver 
    const httpserver = createServer(app);
    //socket server 
    const io = createSocketServer(httpserver, Redis);

    //service layer event emitter of gamesocket
    const gameemitter = new GameEmitter(io, Redis)
    const {gameService, multiPlayer} = createGameServices(gameemitter);

    const gamehandler = new GameSocketHandler(
      io.of('/game'),
      Redis, 
      roomService, 
      matchService, 
      gamerepo, 
      gameemitter,
      gameService,
      new SessionService(),);
    io.of('/game').on('connection', socket => gamehandler.onConnection(socket));

    //friendsocket
    const friendemitter = new FriendEmitter(io, Redis);
    const friendshipservice = createFriendshipService(friendemitter);
    const friendhandler = new FriendSocketHandler(
      io.of('/friendship'),
      Redis,
      friendemitter,
      friendshipservice,
      userrepo
    );
    io.of('/friendship').on('connection', socket=> friendhandler.onConnection(socket));
    

    app.use('/api/auth', AuthRouter);
    app.use('/api/user', UserRouter);
    app.use('/api/game', createGameRouter(gameService));
    app.use('/api/friendship', friendshipRouter);
    //app.use('/api/room', RoomRouter);

    // 3. Start server
    httpserver.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
};

start();