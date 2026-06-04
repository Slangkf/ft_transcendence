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
     * @param lastAnswerOverride 外部可选传入的上一次答题动作更新
     */
    public toUpdateResponse(rawState: GameState, lastAnswerOverride?: any): GameUpdateResponse {
        const now = Date.now();
        
        // 🌟 1. 【防污染深拷贝】：必须深拷贝一份镜像发给前端，绝对不能修改 Redis 原生内存对象
        const state = JSON.parse(JSON.stringify(rawState)) as GameState;

        let isAiThinkingLock = false;
        let aiId: string | undefined;

        // 🌟 2. 【核心魔术判定】：这是 AI 模式，且 Lua 已经塞入时间戳，但视觉显现时间还没到！
        if (state.mode === "AI" && state.aiAnswerVisibleAt && now < state.aiAnswerVisibleAt) {
            aiId = Object.keys(state.players).find(id => state.players[id].isAI);
            
            if (aiId && state.players[aiId]) {
                isAiThinkingLock = true;

                // A. 强行剥夺 AI 在大盘上的 "answered" 状态，降维成自定义的 "playing" 
                //    (前端可以通过 clientState.players[aiId].status 是否属于当前题目的未答状态来播 "..." 动画)
                //    或者你可以扩展 PlayerStatus 增加 "thinking"，这里我们保持兼容，让前端知道 AI 还没“交卷”
                
                // B. 隐藏 AI 刚刚在 Lua 里偷偷记下的最后一题答题记录，防止前端通过 Network 抓包看答案
                if (state.players[aiId].answers.length > 0) {
                    state.players[aiId].answers.pop();
                }

                // C. 核心倒推：因为后端 Lua 已经切题了，如果视觉时间没到，强行把大盘索引退回上一题！
                if (state.currentQuestionIndex > 0) {
                    state.currentQuestionIndex = state.currentQuestionIndex - 1;
                }

                // D. 强行在视觉上遮蔽大盘的完结状态，让游戏看起来还在继续
                state.isFinished = false;
                state.status = "playing";
            }
        }

        // 3. 构造前端需要的玩家快照列表 (PlayerSnapShot)
        const playerSnapshots: Record<string, PlayerSnapShot> = {};
        for (const [id, p] of Object.entries(state.players)) {
            
            // 如果处于 AI 思考锁定时，对 AI 玩家的 status 视觉欺骗
            let visualStatus = p.status;
            if (isAiThinkingLock && id === aiId) {
                // 欺骗前端说 AI 还在玩/思考
                visualStatus = "playing"; 
            }

            playerSnapshots[id] = {
                id: p.id,
                nickname: p.nickname,
                score: p.score,
                status: visualStatus,
                isAI: p.isAI ?? false,
                totalTime: p.Totaltime
            };
        }

        // 4. 判定下一题的 PublicQuestion (剔除 correctAnswerIndex 的安全题干)
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

        // 5. 构筑最终结算面板 (FinalScore)
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
            // 如果 AI 正在被伪装隐藏，则不把上一次的答案返回（或者抹去敏感信息）
            lastAnswerUpdate: isAiThinkingLock ? null : lastAnswerOverride,
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