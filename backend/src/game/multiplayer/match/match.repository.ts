import { redis } from "src/lib/redis";
import { JoinQueueParams, QueuePlayer } from "./match.types";

export class MatchRepository{
    constructor(private redis: redis){}

    private key(mode: string){
        return `matchmaking:queue:${mode}`;
    }

    async getqueue(mode:string): Promise<QueuePlayer[]>{
        const data = await this.redis.lrange(this.key(mode), 0, -1);
        return data.map(item => JSON.parse(item))
    }

    async enqueue(mode:string, player: QueuePlayer): Promise<void>{
        await this.redis.push(
            this.key(mode),
            JSON.stringify(player)
        )
    }

    async   dequeue(mode: string, userIds: string[]): Promise<void>{
        const key = this.key(mode);
        const queue = await this.getqueue(mode);

        const newQueue = queue.filter(player=> !userIds.includes(player.userId))
        await this.redis.del(key);
        if (newQueue.length > 0){
            await this.redis.rpush(
                key,
                ...newQueue.map(p=>JSON.stringify(p))
            )
        }
    }
}