import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

export const redis = createClient({
  url: process.env.REDIS_URL
});

redis.on('error', console.error);
let isConnected = false;

export async function initRedis() {
  if (!isConnected) {
    await redis.connect();
    isConnected = true;
    console.log("Redis connected");
  }
}