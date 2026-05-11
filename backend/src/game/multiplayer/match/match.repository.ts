import { Redis, RedisKeys } from "src/lib/redis";

import { JoinQueueParams, MatchResult, QueuePlayer } from "./match.types";
const MATCH_TTL = 60 * 60; // 1 hour

export class MatchRepository{

    private queuekey(mode: string, size: number){
        return RedisKeys.matchmaking.queue(`${mode}:${size}`);
    }
    private matchkey(matchId: string){
        return RedisKeys.matchmaking.match(matchId);
    }

    private playerkey(userId: string){
        return RedisKeys.matchmaking.player(userId);
    }

    private queueCtxKey(userId: string){
        return RedisKeys.matchmaking.queueCtx(userId);
    }

    async setQueueCtx(userId: string, mode: string, size: number): Promise<void>{
        await Redis.set(this.queueCtxKey(userId), JSON.stringify({mode, size}), {EX: MATCH_TTL});
    }

    async getQueueCtx(userId: string): Promise<{mode: string; size: number} | null>{
        const data = await Redis.get(this.queueCtxKey(userId));
        if (!data) return null;
        return JSON.parse(data);
    }

    async clearQueueCtx(userId: string): Promise<void>{
        await Redis.del(this.queueCtxKey(userId));
    }

    async getqueue(mode: string, size: number): Promise<QueuePlayer[]>{
        const data = await Redis.lRange(this.queuekey(mode, size), 0, -1);
        return data.map(item => JSON.parse(item))
    }

    async enqueue(mode: string, size: number, player: QueuePlayer): Promise<void>{
        await Redis.rPush(
            this.queuekey(mode, size),
            JSON.stringify(player)
        )

    }

    async   dequeue(mode: string, size: number, userIds: string[]): Promise<void>{
        const key = this.queuekey(mode, size);
        const queue = await this.getqueue(mode, size);

        const newQueue = queue.filter(player=> !userIds.includes(player.userId))
        await Redis.del(key);
        if (newQueue.length > 0){
            await Redis.rPush(
                key,
                ...newQueue.map(p=>JSON.stringify(p))
            )
        }
    }
    async saveMatch(match: MatchResult): Promise<void>{
        await Redis.set(
            this.matchkey(match.matchId),
            JSON.stringify(match),
            {EX: MATCH_TTL}
        )

        for(const player of match.players){
            await Redis.set(
                this.playerkey(player.userId),
                match.matchId,
                {EX: MATCH_TTL}
            )
        }
    }

    async getMatchByPlayer(userId: string): Promise <MatchResult | null>{
        const matchId = await Redis.get(this.playerkey(userId));
        if (!matchId)
            return null;

        return this.getMatch(matchId);
    }

    async getMatch(matchId: string): Promise<MatchResult | null>{
        const data = await Redis.get(this.matchkey(matchId));
        if (!data)
            return null;
        return JSON.parse(data);
    }

    async deleteMatch(matchId: string, playerIds: string[]): Promise<void>{
        await Redis.del(this.matchkey(matchId));

        for(const userId of playerIds){
            await Redis.del(this.playerkey(userId));
        }
    }

    async removeFromQueue(userId: string, mode: string, size: number): Promise<void>{
        const queue = await this.getqueue(mode, size);
        const filtered = queue.filter(p => p.userId !== userId);

        const key = this.queuekey(mode, size);
        await Redis.del(key);
        if (filtered.length > 0){
            await Redis.rPush(
                key,
                ...filtered.map(p => JSON.stringify(p))
            )
        }
        await Redis.del(this.playerkey(userId));
    }
}
