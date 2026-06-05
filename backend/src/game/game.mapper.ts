// src/game/game.mapper.ts
import {
    BaseGameState,
    GameUpdateResponse,
    PlayerSnapShot,
    FinalScore,
    MatchResult,
    PublicQuestion
} from "./game.types";
import { GameMode } from "@prisma/client";

export class GameMapper {

    /**
     * 将 Redis 中的运行时 GameState 转换成前端 DTO。
     * lastAnswerUpdate 独立携带刚刚答完那题的正确答案，nextQuestion 始终指向服务端真实当前题。
     * @param rawState 从 Redis 中捞出来的绝对真实的最新快照
     * @param lastAnswerOverride 外部传入的当前用户的答题动作结果
     */
    public toUpdateResponse(rawState: BaseGameState, lastAnswerOverride?: any): GameUpdateResponse {
        // 深拷贝防止污染分布式缓存中的实体
        const state = JSON.parse(JSON.stringify(rawState)) as BaseGameState;

        const playerSnapshots: Record<string, PlayerSnapShot> = {};
        for (const [id, p] of Object.entries(state.players)) {
            playerSnapshots[id] = {
                id: p.id,
                nickname: p.nickname,
                score: p.score,
                status: p.status,
                isAI: p.isAI ?? false,
                totalTime: p.Totaltime // 确保与类型定义的字段大小写对齐
            };
        }

        let nextQuestion: PublicQuestion | null = null;
        if (!state.isFinished) {
            const currentQ = state.questions[state.currentQuestionIndex];
            if (currentQ) {
                nextQuestion = {
                    id: currentQ.id,
                    question: currentQ.question,
                    options: currentQ.options
                };
            }
        }

        let finalScore: FinalScore | null = null;
        if (state.isFinished) {
            finalScore = this.toFinalScore(state);
        }

        return {
            gameId: state.gameId,
            mode: state.mode as GameMode,
            status: state.isFinished ? "finished" : "playing",
            state: {
                currentQuestionIndex: state.currentQuestionIndex,
                totalQuestions: state.questions.length,
                player: playerSnapshots,
                startedAt: state.startedAt,
                questionStartedAt: state.questionStartedAt
            },
            lastAnswerUpdate: lastAnswerOverride ?? null,
            nextQuestion,
            finalScore
        };
    }

    /**
     * 辅助方法：生成最终得分排行榜
     */
    private toFinalScore(state: BaseGameState): FinalScore {
        const scores: Record<string, number> = {};
        const playerEntries = Object.values(state.players);

        for (const p of playerEntries) {
            scores[p.id] = p.score;
        }

        // 根据分数降序，分数相同按总用时升序排序
        const sortedPlayers = [...playerEntries].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.Totaltime - b.Totaltime;
        });

        const winnerId = sortedPlayers[0]?.id ?? "";

        const ranking = sortedPlayers.map((p, index) => ({
            playerId: p.id,
            nickname: p.nickname,
            score: p.score,
            rank: index + 1,
            totalTime: p.Totaltime
        }));

        return {
            winnerId,
            finishedAt: Date.now(),
            scores,
            ranking
        };
    }

    /**
     * 将内存状态转换成可以交付给 Prisma 存入 SQL 数据库的历史战绩实体 (MatchResult)
     */
    public toMatchResult(state: BaseGameState): MatchResult {
        const playerEntries = Object.values(state.players);

        // 生成最终的名次分布
        const sortedPlayers = [...playerEntries].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.Totaltime - b.Totaltime;
        });

        const winnerId = sortedPlayers[0]?.id;

        const playersMapped = playerEntries.map(p => {
            const rankIndex = sortedPlayers.findIndex(sortedP => sortedP.id === p.id);
            return {
                userId: p.id,
                score: p.score,
                rank: rankIndex !== -1 ? rankIndex + 1 : 1,
                correctAnswers: p.answers.filter(a => a.isCorrect).length,
                totalQuestions: state.questions.length
            };
        });

        return {
            gameId: state.gameId,
            mode: state.mode as GameMode,
            winnerId,
            startedAt: state.startedAt,
            finishedAt: Date.now(),
            players: playersMapped
        };
    }
}
