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
        // Legacy SoloService hook kept for compatibility; AI mode answers atomically in LocalMultiPlayer.
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

        if (Math.random() < successThreshold) {
            selectedAnswerIndex = correctAnswerIndex;
        } else {
            do {
                selectedAnswerIndex = Math.floor(Math.random() * totalOptions);
            } while (selectedAnswerIndex === correctAnswerIndex && totalOptions > 1);
        }

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
