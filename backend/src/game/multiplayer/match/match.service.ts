import { AppError, ErrorCode } from "src/error/apperror";
import { MatchRepository } from "./match.repository";
import { JoinRoomParams } from "../../../room/room.types";
import { JoinQueueParams, MatchResult, MathQueueResult } from "./match.types";
import { randomUUID } from "crypto";

export class    MatchService{
    constructor(private matchrepository: MatchRepository){}

    async joinQueue(params: JoinQueueParams): Promise<MathQueueResult>{
        const queue = await this.matchrepository.getqueue(params.mode);
        const exist = queue.find(q => q.userId === params.userId);
        if (exist) throw new AppError(
            'Player already in queue',
            ErrorCode.MATCH_PLAYER_EXIST,
        )
        await this.matchrepository.enqueue(params.mode, {
            userId: params.userId,
            nickname: params.nickname,
            jointedAt: Date.now(),
        })
        return {
            status: "in queue",
            position: queue.length + 1
        }
    }

    async matchPlayers(mode: string ): Promise<MatchResult | null>{
        const queue = await this.matchrepository.getqueue(mode);
        const maxplayers = this.getmaxplayersfrommode(mode);

        if (!maxplayers) throw new AppError(
                    'Game mode unkown',
                    ErrorCode.GAME_UNKOWN_MODE,
                )
        // recupere la queue dans repo
        if (queue.length < maxplayers) //need a systeme to sleep and wait the next time? 
            return null; // Not enough players
        const matchplayers = queue.slice(0, maxplayers);
        const matchId = randomUUID();

        //delete in queue
            await this.matchrepository.dequeue(
                mode, 
                matchplayers.map(p=>p.userId))
        return {
            players: matchplayers,
            matchId,
            mode,
            maxPlayers: maxplayers
        }
    }

    private getmaxplayersfrommode(mode: string):number{
        switch(mode){
            case 'multiplayer':
                return 2;
            case 'tournament': //mode name need to check
                return 3;
            default:
                throw new AppError(
                    'Game mode unkown',
                    ErrorCode.GAME_UNKOWN_MODE,
                )
        }
    }
}