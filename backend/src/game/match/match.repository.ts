import { Redis, RedisKeys } from "src/lib/redis";

import { JoinQueueParams, MatchResult, QueuePlayer } from "./match.types";
const MATCH_TTL = 60 * 60; // 1 hour

export class MatchRepository{

    private queuekey(mode: string){
        return RedisKeys.matchmaking.queue(mode);
    }
    private matchkey(matchId: string){
        return RedisKeys.matchmaking.match(matchId);
    }

    private playerkey(userId: string){
        return RedisKeys.matchmaking.player(userId);
    }

    async getqueue(mode:string): Promise<QueuePlayer[]>{
        const data = await Redis.lRange(this.queuekey(mode), 0, -1);
        return data.map(item => JSON.parse(item))
    }

    async enqueue(mode:string, player: QueuePlayer): Promise<void>{
        await Redis.rPush(
            this.queuekey(mode),
            JSON.stringify(player)
        )
        
    }

    async   dequeue(mode: string, userIds: string[]): Promise<void>{
        const key = this.queuekey(mode);
        const queue = await this.getqueue(mode);

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

    async removeFromQueue(userId: string): Promise<void>{
        const mode = await Redis.get(this.playerkey(userId));

        if (!mode)
            return;
        const queue = await this.getqueue(mode);
        const new_queue = queue.filter(p => p.userId !== userId);

        const key = this.queuekey(mode);
        await Redis.del(key);
        if (new_queue.length > 0){
            await Redis.rPush(
                key, 
                ...new_queue.map(p=> JSON.stringify(p))
            )
        }
        await Redis.del(this.playerkey(userId));
    }
}