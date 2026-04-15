import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import { createClient } from 'redis';

import { AuthRouter } from './auth/auth.router';
import { UserRouter } from './User/user.router';
import gameRouter from './game/game.router';

const app = express();
const PORT = 3000;

// Redis
export const redis = createClient({
  url: process.env.REDIS_URL
});

redis.on('error', console.error);

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