import { Redis, RedisKeys } from "../lib/redis";
import { TournamentState } from "./tournament.types";

const TTL_SECONDS = 2 * 60 * 60; // 2h

export class TournamentRepository {
    /* Persists the tournament state and a per-player index (both with a 2h TTL). */
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

    /* Reads a tournament state by id, or null if absent/expired. */
    async get(tournamentId: string): Promise<TournamentState | null> {
        const data = await Redis.get(RedisKeys.tournament.state(tournamentId));
        return data ? JSON.parse(data) : null;
    }

    /* Resolves the tournament a user belongs to via the per-player index, or null. */
    async getByUser(userId: string): Promise<TournamentState | null> {
        const tid = await Redis.get(RedisKeys.tournament.user(userId));
        if (!tid) return null;
        return this.get(tid);
    }

    /* Deletes the tournament state and all its per-player index keys. */
    async delete(state: TournamentState): Promise<void> {
        await Redis.del(RedisKeys.tournament.state(state.tournamentId));
        await Promise.all(
            state.players.map(p =>
                Redis.del(RedisKeys.tournament.user(p.userId))
            )
        );
    }
}
