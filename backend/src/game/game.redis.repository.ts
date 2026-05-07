import { GameState } from './game.types';

export interface IGameRepository {
    create(game:GameState): Promise<void>;
    findById(gameId: string): Promise<GameState | null>;
    update(game: GameState): Promise<void>;
    delete(gameId: string): Promise<void>;
}

import { Redis, RedisKeys } from 'src/lib/redis';

export class RedisGameRepository implements IGameRepository
{
    private key(gameId: string) {
        return RedisKeys.game.state(gameId);
    }
   public async create(game: GameState): Promise<void>{
    await Redis.set(
        this.key(game.gameId),
        JSON.stringify(game),
        {EX: 3600})
   }

   public async findById(gameId: string): Promise<GameState | null>{
    const data = await Redis.get(this.key(gameId));
    return data ? JSON.parse(data) : null
   }

   public async update(game: GameState): Promise<void>{
    await Redis.set(
        this.key(game.gameId),
        JSON.stringify(game),
        {EX: 3600}
    )
   }

   public async delete(gameId: string): Promise<void>{
    await Redis.del(this.key(gameId))
   }
}

// redis version: 
/***
 * 1. save the gamestate in json version in redis 
 * 2. when lost connection can come back with redis 
 * 3. redis can save the information for only 1h 
 * 4. when all information saved in database, delete in redis 
 * 
 */