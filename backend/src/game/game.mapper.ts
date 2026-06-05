// src/game/game.mapper.ts
import { 
    GameState, 
    GameUpdateResponse, 
    PlayerSnapShot, 
    FinalScore, 
    MatchResult, 
    PublicQuestion 
} from "./game.types";
import { GameMode } from "@prisma/client";

export class GameMapper {
    
    /**
     * 将 Redis 中原子超前的运行时 GameState，转换为符合前端人类视觉延迟的 GameUpdateResponse (DTO)
     * @param rawState 从 Redis 中捞出来的绝对真实的最新快照
     * @param lastAnswerOverride 外部传入的当前用户的答题动作结果
     */
    public toUpdateResponse(rawState: GameState, lastAnswerOverride?: any): GameUpdateResponse {
        // 深拷贝防止污染分布式缓存中的实体
        const state = JSON.parse(JSON.stringify(rawState)) as GameState;

        // 🌟【核心修复：视觉脱敏魔法】
        // 如果外层有真实的答题动作反馈，且因为全员答完导致 Lua 已经在底层悄悄推进了题号，
        // 并且游戏还没彻底结束，我们需要在下发的 DTO 中将题号“伪装”回退 1 位。
        // 这样前端渲染“揭晓上一题对错”时，UI 题号才不会突兀地跳格。
        let visualQuestionIndex = state.currentQuestionIndex;
        
        // 只有当有答题更新、不是已经发生连击拦截、且索引大于 0 时才需要回退
        if (
            lastAnswerOverride && 
            lastAnswerOverride.correctText !== 'ALREADY_PROCESSED' && 
            visualQuestionIndex > 0 &&
            !state.isFinished
        ) {
            visualQuestionIndex = visualQuestionIndex - 1;
        }

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
            // 使用我们计算出来的 visualQuestionIndex 来精确索要题目
            // 如果刚刚全员答完切换了题号，这里拿到的依然是刚刚作答的这一题，配合前端做答案揭晓
            const currentQ = state.questions[visualQuestionIndex];
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
                currentQuestionIndex: visualQuestionIndex, // 👈 喂给前端的视觉冻结题号
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
    private toFinalScore(state: GameState): FinalScore {
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
    public toMatchResult(state: GameState): MatchResult {
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