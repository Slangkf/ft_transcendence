import { PrismaClient, Prisma, GameMode } from "@prisma/client";
import {  GameState, MatchResult } from "./game.types";

export class PrismaGameRepository {
    constructor(
        private prisma: PrismaClient
    ){}

    /*
     * Persists a finished match in one transaction.
     * - Stores the MatchResult and per-human-player rows (AI players skipped).
     * - Bumps each human's played count and score, and wins when they won
     *   (SOLO win = >= SOLO_WIN_THRESHOLD correct; else finishing first).
     */
    async create(result: MatchResult): Promise<void> {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const winnerIdNum = parseInt(result.winnerId ?? "");
            const humanPlayers = result.players.filter(p => {
            const id = String(p.userId);
            return !id.startsWith('ai_') && !isNaN(parseInt(id));
        });

            // SOLO has no opponent, so the single player is always ranked #1 and
            // can't "beat" anyone. Instead of crediting (or never crediting) a win
            // for every finished solo game, a solo win is earned on PERFORMANCE:
            // the player must reach at least SOLO_WIN_THRESHOLD correct answers.
            // For AI / multiplayer a win still means actually finishing first.
            const SOLO_WIN_THRESHOLD = 5;
            const isWin = (p: { userId: string; correctAnswers: number }): boolean =>
                result.mode === GameMode.SOLO
                    ? p.correctAnswers >= SOLO_WIN_THRESHOLD
                    : result.winnerId === p.userId;

            await tx.matchResult.create({
                data: {
                    mode: result.mode,
                    winnerId: !isNaN(winnerIdNum) ? winnerIdNum : null,
                    players: {
                        create: humanPlayers.map(p => ({
                            userId: parseInt(String(p.userId)),
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
                            score: { increment: p.correctAnswers },
                            wins: isWin(p) ? { increment: 1 } : undefined,
                        }
                    })
                )
            );
        });
    }

    /* Returns the user's 20 most recent matches, with co-players and winner info. */
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

    /* Returns the top 10 users ranked by total score (mode arg currently unused). */
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