import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import { AuthRouter } from './auth/auth.router';
import { UserRouter } from './User/user.router';
import {gameRouter} from './game/game.router';
import { redis } from './lib/redis';

const app = express();
const PORT = 3000;

app.use(cors({
  origin: 'http://localhost:5500',
  credentials: true
}));


// ====== INIT FUNCTION ======
const start = async () => {
  try {
    // 1. Redis connect
    await redis.connect();
    console.log("Redis connected");

    await redis.set("test", "ok");
    console.log(await redis.get("test"));

    // 2. Express setup
    app.use(express.json());
    app.use(cookieParser());

    app.use('/uploads', express.static('uploads'));

    app.use('/api/auth', AuthRouter);
    app.use('/api/user', UserRouter);
    app.use('/game', gameRouter);

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