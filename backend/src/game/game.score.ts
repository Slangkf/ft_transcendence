import { PrismaClient } from "@prisma/client";
import { IGameRepository } from "./game.redis.repository";
import { GameMode, GameState, MatchResult } from "./game.types";

export class PrismaGameRepository {
    constructor(
        private prisma: PrismaClient
    ){}

    async create(result: MatchResult): Promise<void>{
        await this.prisma.$transaction(async (tx) => {
            //1. create in matchresult 
            const match = await tx.matchResult.create({
                data: {
                    mode: this.mapMode(result.mode),
                    winnerId: result.winnerId ?  parseInt(result.winnerId) : null,
                    players: {
                        create: result.players.map(p=> ({
                            userId: parseInt(p.userId),
                            score: p.score,
                            correctAnswers: p.correctAnswers,
                            rank: p.rank,
                        }))
                    }
                }
            })

            //update players
            await Promise.all(
                result.players.map( p=> 
                    tx.user.update({
                        where: {id: parseInt(p.userId)},
                        data: {
                            played: {increment: 1},
                            score: {increment: p.score},
                            wins: result.winnerId === p.userId 
                                ? {increment: 1}
                                : undefined,
                        }
                    })
                )
            )
        })
    }

    async findByUserId(userId: number) {
        return this.prisma.matchResult.findMany({
            where: {
                players: {some: {userId}}
            },
            include: {
                players: {
                    include: { user: { select: { username: true, url: true } } }
                },
                winner: {
                    select: { username: true, url: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        })
    }

    async getLeaderboard(mode?: string) {
        return this.prisma.user.findMany({
            select: {
                id:       true,
                username: true,
                url:      true,
                score:    true,
                wins:     true,
                played:   true,
            },
            orderBy: { score: 'desc' },
            take: 10,
        })
    }

    private mapMode(mode: GameMode): string {
        const map: Record<GameMode, string> = {
            [GameMode.SOLO]:        'SOLO',
            [GameMode.AI]:          'VS_AI',
            [GameMode.MULTIPLAYER]: 'ONE_VS_ONE',
            [GameMode.TOURNAMENT]:  'TOURNAMENT',
        }
        return map[mode]
    }
}