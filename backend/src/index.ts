import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import { AuthRouter } from './auth/auth.router';
import { UserRouter } from './User/user.router';
import {gameRouter} from './game/game.router';
import { RoomRouter } from './room/room.router';
import {initRedis} from './lib/redis';

const app = express();
const PORT = 3000;

app.use(cors({
	// origin: 'http://localhost:5500',	// JIANXIN
  	origin: 'https://localhost:8888', // must match the Origin header sent by the browser (protocol + host + port)
	credentials: true
}));


// ====== INIT FUNCTION ======
const start = async () => {
  try {
    await initRedis();
    // 2. Express setup
    app.use(cookieParser());
    app.use(express.json());

    app.use('/api/auth', AuthRouter);
    app.use('/api/user', UserRouter);
    app.use('/api/game', gameRouter);
    //app.use('/api/room', RoomRouter);

    // 3. Start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
};

start();