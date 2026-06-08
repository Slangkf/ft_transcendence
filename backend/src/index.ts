import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import {createServer} from 'http';

import {initRedis, Redis} from './lib/redis';
import {createSocketServer} from './lib/socket';
import { container } from './container';

// ===== Crash guards =====
// A single unhandled promise rejection / exception used to kill the whole Node
// process; Docker would then restart it — disconnecting EVERY player at once and
// wiping the in-memory Socket.IO rooms + game/ready timers MID-tournament, which
// collapsed the bracket into cascading forfeits/ready-timeouts. We log and stay
// alive instead. (Genuine startup failures still exit via the try/catch in start().)
process.on('unhandledRejection', (reason) => {
  console.error('[GUARD] unhandledRejection (server kept alive):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[GUARD] uncaughtException (server kept alive):', err);
});

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