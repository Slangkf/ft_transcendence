import { FinalScore } from "./types";
import type {MatchResult} from '@prisma/client'

export class HistoryGameRepo 
{
    async save(result: FinalScore): Promise<void>{
        await prisma.MatchResult.create({
            data: {
                winnerId: result.winner,
                players:{
                    create: result.players.map(p => ({
                        userId: p.id,
                        matchId: result.gameId,
                        
                    }))
                }
            }
        })
    }

    async findByUser(userId: string): Promise<>{

    }

    async findById(gameId: string): Promise<>{

    }
}