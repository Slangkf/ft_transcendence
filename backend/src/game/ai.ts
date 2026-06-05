// src/game/ai.service.ts
import { BaseGameState } from "./game.types";

const AI_SKILLS: Record<string, number> = {
    "sciences": 0.70,
    "culture-generale": 0.60,
    "divertissement": 0.60,
    "histoire-geo": 0.40,
    "default": 0.50
};

export class AIService {
    constructor() {}

    public async generateAIAnswer(_gameState: BaseGameState, _aiId: string): Promise<void> {
        // Legacy SoloService hook kept for compatibility; AI mode now answers atomically in LocalMultiPlayer.
    }

    /**
     * Pure Function: 根据当前的题目和AI胜率，计算出AI的答案以及它应当“表现出”的思考时间。
     */
    public predictAnswer(gameState: BaseGameState, aiId: string) {
        const currentQuestionIndex = gameState.currentQuestionIndex;
        
        // 🌟 正确的做法：通过数组【索引/下标】定位当前题干
        const currentQuestion = gameState.questions[currentQuestionIndex];
        
        if (!currentQuestion) {
            throw new Error("[IA] Invalid question index boundary");
        }

        const category = (gameState.category || "default").toLowerCase();
        const successThreshold = AI_SKILLS[category] ?? AI_SKILLS["default"];

        // 1. 模拟人类的思考延迟
        const thinkingDelayMs = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000; 
        const visibleAt = Date.now() + thinkingDelayMs;

        // 2. 核心胜率计算
        const correctAnswerIndex = currentQuestion.correctAnswerIndex;
        const totalOptions = currentQuestion.options.length;
        let selectedAnswerIndex: number;

        // --- 🌟 动态控分逻辑开始 🌟 ---
        const totalQuestions = gameState.questions.length; // 本局总题数
        const aiPlayer = gameState.players[aiId];
        const currentAiScore = aiPlayer ? aiPlayer.score : 0; // AI 当前已经对了几题

        // 计算 AI 允许答对的最大题目数量（向下取整，比如 10 * 0.7 = 7 题）
        const maxAllowedCorrect = Math.floor(totalQuestions * successThreshold);

        if (currentAiScore >= maxAllowedCorrect) {
            // 🔥 铁律：如果 AI 的得分已经达到了上限，百分之百强制它做错！
            console.log(`[IA] 触发控分上限！当前得分 ${currentAiScore} 已达到最高允许值 ${maxAllowedCorrect}。强制做错。`);
            do {
                selectedAnswerIndex = Math.floor(Math.random() * totalOptions);
            } while (selectedAnswerIndex === correctAnswerIndex && totalOptions > 1);
        
        } else {
            // 如果还没到上限，继续走原来的概率流程
            if (Math.random() < successThreshold) {
                selectedAnswerIndex = correctAnswerIndex;
            } else {
                do {
                    selectedAnswerIndex = Math.floor(Math.random() * totalOptions);
                } while (selectedAnswerIndex === correctAnswerIndex && totalOptions > 1);
            }
        }
        // --- 🌟 动态控分逻辑结束 🌟 ---
        const result = {
            aiId,
            questionId: currentQuestion.id, // 这里的 id 是唯一的题目 ID，不能当数组下标用！
            selectedAnswerIndex,
            visibleAt
        };
        
        console.log("result IA: ", result);

        // 🌟 【黄金修复点】：直接使用已经定位好的、安全的全局变量，不要再通过 questionId 去查数组
        const iscorrect = correctAnswerIndex === result.selectedAnswerIndex ? "true" : "false";
        console.log("iscorrect: ", iscorrect);
        console.log("answer: ", correctAnswerIndex);
        
        return result;
    }
}
