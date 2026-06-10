import { MatchRepository } from "./match.repository";
import { JoinQueueParams, MatchResult, MathQueueResult, QueuePlayer } from "./match.types";
import { randomUUID } from "crypto";
import { MatchPlayer } from "../game.types";
import { AppError, ErrorCode } from "../../error/apperror";
import {GameMode} from "@prisma/client"

/**
 * @class MatchService
 * @description manage player matchmaking
 * - add players to matchmaking queues
 * - remove players from queues
 * - track queue state
 * - match players when enough participants are available
 * - create match records
 * - retrieve existing match information 
 */
export class    MatchService{
    constructor(private matchrepository: MatchRepository){}

    /**
     * @method joinQueue
     * @description add a player to matchmaking queue
     * if the player is already queued, their current queue position is returned
     * @param params 
     * @returns 
     */
    async joinQueue(params: JoinQueueParams): Promise<MathQueueResult>{
        const queue = await this.matchrepository.getqueue(params.mode);
        const exist = queue.find(q => q.userId === params.userId);
        if (exist) return { status: "in queue", position: queue.indexOf(exist) + 1 };
        //register player in the matchmaking queue
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

    /**
     * @method matchPlayers
     * @description attempt to create a match from queued players
     * a match is created only when enough players are available for the selected game mode
     * @param mode 
     * @param size 
     * @returns 
     */
    async matchPlayers(mode: GameMode, size?: number): Promise<MatchResult | null>{
        const queue = await this.matchrepository.getqueue(mode);
        const maxplayers = size ?? this.getmaxplayersfrommode(mode);

        if (!maxplayers) throw new AppError(
                    'Game mode unkown',
                    ErrorCode.GAME_UNKOWN_MODE,
                )
        //not enough players available, continue waiting in queue
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

    /* Returns the match the user currently belongs to, or null. */
    async getMyMatch(userId: string): Promise<MatchResult| null>{
        return await this.matchrepository.getMatchByPlayer(userId);
    }

    /* Removes the user from any matchmaking queue they are in. */
    async leaveQueue(userId: string): Promise<void>{
        return await this.matchrepository.removeFromQueue(userId);
    }

    /* Returns a mode's queue as a light {userId, nickname} list. */
    async getQueue(mode: GameMode): Promise<{userId: string; nickname: string}[]>{
        const queue = await this.matchrepository.getqueue(mode);
        return queue.map(({userId, nickname}) => ({userId, nickname}));
    }

    /* Persists changes to an existing match (e.g. its roomId or notified flag). */
    async updatateMatch(match: MatchResult): Promise<void>{
        return await this.matchrepository.saveMatch(match);
    }

    /* Deletes a match and clears its players' index keys (no-op if gone). */
    async deleteMatch(matchId: string): Promise<void>{
        const match = await this.matchrepository.getMatch(matchId);
        if (!match) return ;

        await this.matchrepository.deleteMatch(
            matchId,
            match.players.map(p => p.userId)
        )
    }

    /* Returns the required player count per mode (MULTIPLAYER=2, TOURNAMENT=4); throws otherwise. */
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

