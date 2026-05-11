import { AppError, ErrorCode } from "src/error/apperror";
import { MatchRepository } from "./match.repository";
import { JoinQueueParams, MatchResult, MathQueueResult } from "./match.types";
import { randomUUID } from "crypto";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

export class    MatchService{
    constructor(private matchrepository: MatchRepository){}

    async joinQueue(params: JoinQueueParams): Promise<MathQueueResult>{
        this.validateSize(params.size);
        const queue = await this.matchrepository.getqueue(params.mode, params.size);
        const exist = queue.find(q => q.userId === params.userId);
        if (exist) throw new AppError(
            'Player already in queue',
            ErrorCode.MATCH_PLAYER_EXIST,
        )
        await this.matchrepository.enqueue(params.mode, params.size, {
            userId: params.userId,
            nickname: params.nickname,
            jointedAt: Date.now(),
        })
        await this.matchrepository.setQueueCtx(params.userId, params.mode, params.size);
        return {
            status: "in queue",
            position: queue.length + 1
        }
    }

    async matchPlayers(mode: string, size: number): Promise<MatchResult | null>{
        this.validateSize(size);
        const queue = await this.matchrepository.getqueue(mode, size);

        if (queue.length < size)
            return null;

        const matchplayers = queue.slice(0, size);
        const matchId = randomUUID();

        await this.matchrepository.dequeue(
            mode,
            size,
            matchplayers.map(p=>p.userId))
        for (const mp of matchplayers){
            await this.matchrepository.clearQueueCtx(mp.userId);
        }

        const result: MatchResult = {
            players: matchplayers,
            matchId,
            roomId: '',
            mode,
            createdAt: Date.now(),
            maxPlayers: size,
        }
        await this.matchrepository.saveMatch(result);
        return result
    }

    async getMyMatch(userId: string): Promise<MatchResult| null>{
        return await this.matchrepository.getMatchByPlayer(userId);
    }

    async leaveQueue(userId: string, mode?: string, size?: number): Promise<void>{
        if (mode && size){
            await this.matchrepository.removeFromQueue(userId, mode, size);
            await this.matchrepository.clearQueueCtx(userId);
            return;
        }
        const ctx = await this.matchrepository.getQueueCtx(userId);
        if (!ctx) return;
        await this.matchrepository.removeFromQueue(userId, ctx.mode, ctx.size);
        await this.matchrepository.clearQueueCtx(userId);
    }

    async updatateMatch(match: MatchResult): Promise<void>{
        return await this.matchrepository.saveMatch(match);
    }

    private validateSize(size: number){
        if (!Number.isInteger(size) || size < MIN_PLAYERS || size > MAX_PLAYERS){
            throw new AppError(
                `Invalid player size, must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`,
                ErrorCode.GAME_UNKOWN_MODE,
                400,
            );
        }
    }
}
