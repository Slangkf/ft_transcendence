import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

export const Redis = createClient({
  url: process.env.REDIS_URL
});

Redis.on('error', console.error);
let isConnected = false;

export async function initRedis() {
  if (!isConnected) {
    await Redis.connect();
    isConnected = true;
    console.log("Redis connected");
  }
}

export const RedisKeys = {

  matchmaking: {
    queue: (mode: string)=>`matchmaking:v1:queue:${mode}`,
    match: (matchId: string) => `matchmaking:v1:match:${matchId}`,
    player: (userId: string) => `matchmaking:v1:player:${userId}`,
    queueCtx: (userId: string) => `matchmaking:v1:queueCtx:${userId}`,
  },

  game:{
    state: (gameId: string)=> `game:v1:state:${gameId}`,
    room: (roomId: string) => `game:v1:room:${roomId}`,
  },

  socket:{
    gameUser: (userId: string)=> `socket:v1:gameUser:${userId}`,
    chatUser: (userId: string)=> `socket:v1:chatUser:${userId}`,
    friendUser: (userId: string)=> `socket:v1:friendUser:${userId}`,
    disconnect: (userId: string)=> `socket:v1:disconnect:${userId}`,
    chatDisconnect: (userId: string)=> `socket:v1:chatdisconnect:${userId}`,
  },

  session:{
    user: (userId: string)=> `session:v1:user:${userId}`,
  },

  tournament:{
    state: (tournamentId: string)=> `tournament:v1:state:${tournamentId}`,
    user: (userId: string)=> `tournament:v1:user:${userId}`,
  }
}
/**
 * Redis configuration and key management
 * 
 * - create and manage the redis client
 * - initialize redis connection
 * 
 * key format:
 *  ${domain}:${version}:${type}:${id}
 * 
 */