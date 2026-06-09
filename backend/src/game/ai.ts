// src/game/ai.service.ts
import { BaseGameState } from "./game.types";

// Success probabilities based on quiz categories
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
     * Pure Function: Calculates the AI's selected answer and simulated thinking delay 
     * based on the current question and the AI's category-specific win rate.
     */
    public predictAnswer(gameState: BaseGameState, aiId: string) {
        const currentQuestionIndex = gameState.currentQuestionIndex;
        
        //  Locate the current question safely using the array index
        const currentQuestion = gameState.questions[currentQuestionIndex];
        
        if (!currentQuestion) {
            throw new Error("[IA] Invalid question index boundary");
        }

        const category = (gameState.category || "default").toLowerCase();
        const successThreshold = AI_SKILLS[category] ?? AI_SKILLS["default"];

        // 1. Simulate human thinking delay (between 2000ms and 5000ms)
        const thinkingDelayMs = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000; 
        const visibleAt = Date.now() + thinkingDelayMs;

        // 2. Core answer selection logic
        const correctAnswerIndex = currentQuestion.correctAnswerIndex;
        const totalOptions = currentQuestion.options.length;
        let selectedAnswerIndex: number;

        // ---  Dynamic Score Control Logic Start  ---
        const totalQuestions = gameState.questions.length; // Total questions in this match
        const aiPlayer = gameState.players[aiId];
        const currentAiScore = aiPlayer ? aiPlayer.score : 0; // Number of questions AI has answered correctly so far

        // Calculate the maximum number of correct answers allowed for the AI (rounded down, e.g., 10 * 0.7 = 7)
        const maxAllowedCorrect = Math.floor(totalQuestions * successThreshold);

        if (currentAiScore >= maxAllowedCorrect) {
            //  Hard Rule: If the AI has reached or exceeded its score ceiling, force it to choose a wrong answer!
            console.log(`[IA] Score ceiling triggered! Current score ${currentAiScore} reached max allowed ${maxAllowedCorrect}. Forcing an incorrect answer.`);
            do {
                selectedAnswerIndex = Math.floor(Math.random() * totalOptions);
            } while (selectedAnswerIndex === correctAnswerIndex && totalOptions > 1);
        
        } else {
            // If the ceiling hasn't been reached, proceed with the standard probability check
            if (Math.random() < successThreshold) {
                selectedAnswerIndex = correctAnswerIndex; // Correct answer
            } else {
                // Wrong answer selection loop
                do {
                    selectedAnswerIndex = Math.floor(Math.random() * totalOptions);
                } while (selectedAnswerIndex === correctAnswerIndex && totalOptions > 1);
            }
        }
        // ---  Dynamic Score Control Logic End  ---

        const result = {
            aiId,
            questionId: currentQuestion.id, // This is a unique question UID, NOT to be used as an array index!
            selectedAnswerIndex,
            visibleAt
        };
        
        console.log("result IA: ", result);

        //  Directly use the already resolved, safe variables instead of querying the array via questionId
        const iscorrect = correctAnswerIndex === result.selectedAnswerIndex ? "true" : "false";
        console.log("iscorrect: ", iscorrect);
        console.log("answer: ", correctAnswerIndex);
        
        return result;
    }
}