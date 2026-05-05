import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import {createServer} from 'http';

import { AuthRouter } from './auth/auth.router';
import { UserRouter } from './User/user.router';
<<<<<<< HEAD
import {createGameRouter} from './game/game.router';
import friendshipRouter from './friendship/friendship.router';
import {initRedis, Redis} from './lib/redis';
import {createSocketServer} from './lib/socket';
import {SocketHandler} from './websocket/socket.handler';
import {SocketEmitter} from './websocket/socket.emitter';
import { createGameServices,
  roomManager,
  matchService,
  gamerepo,
} from './container';


const app = express();
const PORT = 3000;



// ====== INIT FUNCTION ======
const start = async () => {
  try {
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

    //service layer event emitter of socket
    const emitter = new SocketEmitter(io, Redis)
    const {gameService} = createGameServices(emitter);

    const handler = new SocketHandler(
      Redis, 
      roomManager, 
      matchService, 
      gamerepo, 
      emitter);
    io.on('connection', socket => handler.onConnection(socket));

    app.use('/api/auth', AuthRouter);
    app.use('/api/user', UserRouter);
<<<<<<< HEAD
    app.use('/api/game', createGameRouter(gameService));
=======
    app.use('/api/game', gameRouter);
>>>>>>> main
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