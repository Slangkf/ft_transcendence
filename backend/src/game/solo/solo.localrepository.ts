import { GameState} from '../game.types';

export interface IGameRepository {
    create(game:GameState): Promise<void>;
    findById(gameId: string): Promise<GameState | null>;
    update(game: GameState): Promise<void>;
    delete(gameId: string): Promise<void>;
}

//export class LocalGameRepository implements IGameRepository
//{
//    private games = new Map<string, GameState>();
//
//    public async create(game: GameState): Promise<void>
//    {
//        this.games.set(game.gameId, structuredClone(game));
//    }
//
//    public async findById(gameId: string): Promise<GameState | null>
//    {
//        return this.games.get(gameId) ?? null;
//    }
//
//    public async update(game: GameState): Promise<void>
//    {
//        this.games.set(game.gameId, structuredClone(game));
//    }
//
//    public async delete(gameId: string): Promise<void>
//    {
//        this.games.delete(gameId);
//    }
//}
import { redis } from 'src/lib/redis';

export class RedisGameRepository implements IGameRepository
{
    private key(gameId: string) {
        return `game:${gameId}`;
    }
   public async create(game: GameState): Promise<void>{
    await redis.set(
        this.key(game.gameId),
        JSON.stringify(game),
        {EX: 3600})
   }

   public async findById(gameId: string): Promise<GameState | null>{
    const data = await redis.get(this.key(gameId));
    return data ? JSON.parse(data) : null
   }

   public async update(game: GameState): Promise<void>{
    await redis.set(
        this.key(game.gameId),
        JSON.stringify(game)
    )
   }

   public async delete(gameId: string): Promise<void>{
    await redis.del(this.key(gameId))
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