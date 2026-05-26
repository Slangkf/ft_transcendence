import { PrismaClient, Prisma, GameMode } from "@prisma/client";
import {  GameState, MatchResult } from "./game.types";

export class PrismaGameRepository {
    constructor(
        private prisma: PrismaClient
    ){}

    async create(result: MatchResult): Promise<void> {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const winnerIdNum = parseInt(result.winnerId ?? "");
            const humanPlayers = result.players.filter(p => p.userId !== "brain");

            await tx.matchResult.create({
                data: {
                    mode: result.mode,
                    winnerId: !isNaN(winnerIdNum) ? winnerIdNum : null,
                    players: {
                        create: humanPlayers.map(p => ({
                            userId: parseInt(p.userId),
                            score: p.score,
                            correctAnswers: p.correctAnswers,
                            rank: p.rank,
                        }))
                    }
                }
            });

            await Promise.all(
                humanPlayers.map(p =>
                    tx.user.update({
                        where: { id: parseInt(p.userId) },
                        data: {
                            played: { increment: 1 },
                            score: { increment: p.score },
                            wins: result.winnerId === p.userId
                                ? { increment: 1 }
                                : undefined,
                        }
                    })
                )
            );
        });
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

}