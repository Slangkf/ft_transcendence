import { Redis, RedisKeys } from "../../lib/redis"

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
                newQueue.map(p=>JSON.stringify(p))
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
        // Scan the ACTUAL queue keys instead of guessing mode names. The previous
        // version hard-coded lowercase modes ('tournament', 'multiplayer', …), but the
        // queues are keyed by the Prisma GameMode enum, which is UPPERCASE
        // (matchmaking:v1:queue:TOURNAMENT). The case never matched, so a player who
        // pressed "Cancel" in the tournament lobby was never actually removed from the
        // queue — they stayed "in the tournament" and got pulled into the next one.
        const keys = await Redis.keys(this.queuekey('*'));

        for (const key of keys) {
            const data = await Redis.lRange(key, 0, -1);
            const queue = data.map(item => JSON.parse(item) as QueuePlayer);
            if (queue.some(p => p.userId === userId)) {
                const new_queue = queue.filter(p => p.userId !== userId);
                await Redis.del(key);
                if (new_queue.length > 0){
                    for(const item of new_queue){
                        await Redis.rPush(key, JSON.stringify(item))
                    }
                }
                break; // Player was only in one queue
            }
        }

        // Also clean up the player key
        await Redis.del(this.playerkey(userId));
    }
}