import { GameState } from './game.types';

export class GameRepository
{
    private games = new Map<string, GameState>();

    public create(game: GameState): void
    {
        this.games.set(game.id, game);
    }

    public findById(gameId: string): GameState | null
    {
        return this.games.get(gameId) ?? null;
    }

    public update(game: GameState): void
    {
        this.games.set(game.id, game);
    }

    public delete(gameId: string): void
    {
        this.games.delete(gameId);
    }
}
