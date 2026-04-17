import { GameState} from '../game.types';

export interface IGameRepository {
    create(game:GameState): Promise<void>;
    findById(gameId: string): Promise<GameState | null>;
    update(game: GameState): Promise<void>;
    delete(gameId: string): Promise<void>;
}

export class LocalGameRepository implements IGameRepository
{
    private games = new Map<string, GameState>();

    public async create(game: GameState): Promise<void>
    {
        this.games.set(game.gameId, structuredClone(game));
    }

    public async findById(gameId: string): Promise<GameState | null>
    {
        return this.games.get(gameId) ?? null;
    }

    public async update(game: GameState): Promise<void>
    {
        this.games.set(game.gameId, structuredClone(game));
    }

    public async delete(gameId: string): Promise<void>
    {
        this.games.delete(gameId);
    }
}
