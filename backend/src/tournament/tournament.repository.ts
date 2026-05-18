import { Redis, RedisKeys } from "../lib/redis";
import { TournamentState } from "./tournament.types";

const TTL_SECONDS = 2 * 60 * 60; // 2h

export class TournamentRepository {
    async save(state: TournamentState): Promise<void> {
        await Redis.set(
            RedisKeys.tournament.state(state.tournamentId),
            JSON.stringify(state),
            { EX: TTL_SECONDS }
        );
        // index each player → tournamentId for fast reconnect
        await Promise.all(
            state.players.map(p =>
                Redis.set(
                    RedisKeys.tournament.user(p.userId),
                    state.tournamentId,
                    { EX: TTL_SECONDS }
                )
            )
        );
    }

    async get(tournamentId: string): Promise<TournamentState | null> {
        const data = await Redis.get(RedisKeys.tournament.state(tournamentId));
        return data ? JSON.parse(data) : null;
    }

    async getByUser(userId: string): Promise<TournamentState | null> {
        const tid = await Redis.get(RedisKeys.tournament.user(userId));
        if (!tid) return null;
        return this.get(tid);
    }

    async delete(state: TournamentState): Promise<void> {
        await Redis.del(RedisKeys.tournament.state(state.tournamentId));
        await Promise.all(
            state.players.map(p =>
                Redis.del(RedisKeys.tournament.user(p.userId))
            )
        );
    }
}
