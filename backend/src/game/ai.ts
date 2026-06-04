// src/game/ai.ts
import { GameState } from "./game.types";
import { LocalMultiPlayer } from "./game.local";
import { RedisGameRepository } from "./game.redis.repository"; // 🌟 引入你的 Redis 仓储
import { clear } from "console";

const AI_SKILLS: Record<string, number> = {
    "sciences": 0.70,
    "culture-generale": 0.60,
    "divertissement": 0.60,
    "histoire-geo": 0.40,
    "default": 0.50
};

export class AIService {
    // 🌟 构造函数中同时注入 LocalMultiPlayer 和 RedisGameRepository
    constructor(
        private readonly multiservice: LocalMultiPlayer,
        private readonly gameRepository: RedisGameRepository,
        private aiTimers = new Map<string, NodeJS.Timeout>()
    ) {}

    public async generateAIAnswer(gameState: GameState, aiId: string): Promise<void> {
        if (gameState.isFinished) return;

        // 1. 获取触发这一刻的题号（用于日志或初始参考）
        const triggerQuestionIndex = gameState.currentQuestionIndex;
        const targetGameId = gameState.gameId;

        // 2. 随机生成 AI 的思考时间（2-6秒）
        const thinkingTime = Math.floor(Math.random() * (6000 - 2000 + 1)) + 2000;

        const oldtimer = this.aiTimers.get(targetGameId);
        if (oldtimer){
            this.clearAITimer(targetGameId)
        }
        const timer = setTimeout(async () => {
            try {
                // 🌟 【核心防御】：定时器到期了，现在去 Redis 拿最真实、最新的全场状态
                const freshState = await this.gameRepository.findById(targetGameId);
                
                // 如果游戏在 Redis 里已经被人类打通关删除了，或者不存在，优雅退出
                if (!freshState || freshState.isFinished) {
                    console.log(`[IA] 游戏 ${targetGameId} 已结束或已被清理，AI 取消答题。`);
                    return;
                }

                // 🌟 【核心防御 2】：获取 Redis 里当前的真实题号
                const currentQuestionIndex = freshState.currentQuestionIndex;
                const currentQuestion = freshState.questions[currentQuestionIndex];
                
                if (!currentQuestion) return;

                // 🌟 【核心防御 3】：看看在这个延迟期间，AI 是不是其实已经答过这一题了？
                const aiPlayer = freshState.players[aiId];
                console.log("aiid: ", aiId);
                console.log("players: ", Object.keys(freshState.players))
                if (aiPlayer) {
    // 🌟 防御：如果 AI 答过的总题数已经超过或等于了当前最新的 Redis 题号
    // 说明这一题 AI 已经完成过本地提交了（比如 AI 先答的情况），安全拦截，防止二次提交
    if (aiPlayer.answers.length > currentQuestionIndex) {
        console.log(`[IA] AI 在第 ${currentQuestionIndex} 题已经有答案了，放弃重复执行。`);
        return;
    }
}

                // 3. 此时数据绝对新鲜，基于当前真实的题目计算答案
                const correctAnswerIndex = currentQuestion.correctAnswerIndex;
                const totalOptions = currentQuestion.options.length;
                const category = (freshState.category || "default").toLowerCase();
                const successThreshold = AI_SKILLS[category] ?? AI_SKILLS["default"];

                const randomNumber = Math.random();
                let selectedAnswerIndex: number;

                if (randomNumber < successThreshold) {
                    selectedAnswerIndex = correctAnswerIndex;
                } else {
                    do {
                        selectedAnswerIndex = Math.floor(Math.random() * totalOptions);
                    } while (selectedAnswerIndex === correctAnswerIndex && totalOptions > 1);
                }

                console.log(`[IA] 定时器到期。正在对第 ${currentQuestionIndex} 题原子化提交答案。`);
                
                // 4. 提交进 Lua 脚本。此时题号、用户 ID、游戏 ID 与 Redis 完全同步，绝不会被 Lua 拒绝
                await this.multiservice.submitAnswer(targetGameId, selectedAnswerIndex, aiId);

            } catch (error: any) {
                console.error("[IA] 异步提交发生错误:", error);

                if (error.code === 'GAME_NOT_FOUND') return;
            }
        }, thinkingTime);

        this.aiTimers.set(targetGameId, timer);
    }

    public clearAITimer(gameId: string) {
    const timer = this.aiTimers.get(gameId);
    if (timer) {
        clearTimeout(timer);
        this.aiTimers.delete(gameId);
    }
}
}