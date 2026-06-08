import { MatchRepository } from "./match.repository";
import { JoinQueueParams, MatchResult, MathQueueResult, QueuePlayer } from "./match.types";
import { randomUUID } from "crypto";
import { MatchPlayer } from "../game.types";
import { AppError, ErrorCode } from "../../error/apperror";
import {GameMode} from "@prisma/client"

export class    MatchService{
    constructor(private matchrepository: MatchRepository){}

    async joinQueue(params: JoinQueueParams): Promise<MathQueueResult>{
        const queue = await this.matchrepository.getqueue(params.mode);
        const exist = queue.find(q => q.userId === params.userId);
        if (exist) return { status: "in queue", position: queue.indexOf(exist) + 1 };
        await this.matchrepository.enqueue(params.mode, {
            userId: params.userId,
            nickname: params.nickname,
            joinedAt: Date.now(),
            mode: params.mode,
        })
        return {
            status: "in queue",
            position: queue.length + 1
        }
    }

    async matchPlayers(mode: GameMode, size?: number): Promise<MatchResult | null>{
        const queue = await this.matchrepository.getqueue(mode);
        const maxplayers = size ?? this.getmaxplayersfrommode(mode);

        if (!maxplayers) throw new AppError(
                    'Game mode unkown',
                    ErrorCode.GAME_UNKOWN_MODE,
                )
        if (queue.length < maxplayers)
            return null;
        const matchplayers: MatchPlayer[] = queue.slice(0, maxplayers)
                                                .map(({userId, nickname})=> ({
                                                    userId,
                                                    nickname,
                                                }));
        const matchId = randomUUID();

        //delete in queue
        await this.matchrepository.dequeue(
            mode, 
            matchplayers.map(p=>p.userId))
        
        //save the result of matchplayers in database
        const result: MatchResult = {
            players: matchplayers,
            matchId,
            roomId: '', //need to update after create room
            mode,
            createdAt: Date.now(),
            maxPlayers: maxplayers,
            notified: false,
        }
        await this.matchrepository.saveMatch(result);
        return result
    }

    async getMyMatch(userId: string): Promise<MatchResult| null>{
        return await this.matchrepository.getMatchByPlayer(userId);
    }

    async leaveQueue(userId: string): Promise<void>{
        return await this.matchrepository.removeFromQueue(userId);
    }

    async getQueue(mode: GameMode): Promise<{userId: string; nickname: string}[]>{
        const queue = await this.matchrepository.getqueue(mode);
        return queue.map(({userId, nickname}) => ({userId, nickname}));
    }

    async updatateMatch(match: MatchResult): Promise<void>{
        return await this.matchrepository.saveMatch(match);
    }

    async deleteMatch(matchId: string): Promise<void>{
        const match = await this.matchrepository.getMatch(matchId);
        if (!match) return ;

        await this.matchrepository.deleteMatch(
            matchId,
            match.players.map(p => p.userId)
        )
    }

    private getmaxplayersfrommode(mode: GameMode):number{
        switch(mode){
            case "MULTIPLAYER":
                return 2;
            case "TOURNAMENT":
                return 4;
            default:
                throw new AppError(
                    'Game mode unkown',
                    ErrorCode.GAME_UNKOWN_MODE,
                )
        }
    }
}

/**
 * match service: 
 *  put the players in the systeme of queue to wait
 *  get the maxplayers from the different mode of game
 *  try to match the players for the mode
 * 
 * 
 * 
 */