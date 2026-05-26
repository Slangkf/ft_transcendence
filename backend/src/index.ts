import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import {createServer} from 'http';

import {initRedis, Redis} from './lib/redis';
import {createSocketServer} from './lib/socket';
import { container } from './container';
import { ChatSocketHandler } from './websocket/socket.chatHandler';


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
      origin: true, // must match the Origin header sent by the browser (protocol + host + port)
      credentials: true
    }));
    app.use('/avatars', express.static('avatars'));

    app.get('/api/health', (req, res) => res.json({ ok: true }));

    //httpserver 
    const httpserver = createServer(app);
    //socket server 
    const {io, gameNs, friendNs, chatNs} = createSocketServer(httpserver, Redis);

    //initialise container with all dependances
    await container.initialize(io, gameNs, friendNs, chatNs, Redis);

    //socket handler
    gameNs.on('connection', socket => container.gameSocketHandler.onConnection(socket));
    friendNs.on('connection', socket => container.friendSocketHandler.onConnection(socket));
    chatNs.on('connection', socket => container.chatSocketHandler.onConnection(socket));


    app.use('/api/auth', container.authRouter);
    app.use('/api/user', container.userRouter);
    app.use('/api/game', container.gameRouter);
    app.use('/api/friendship', container.friendRouter);
    app.use('/api/chat', container.chatRouter);
    app.use('/api/tournament', container.tournamentRouter);

    // 3. Start server
    httpserver.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });

  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
};

start();