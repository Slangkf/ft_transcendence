import { GameState } from "./game.types";
import { GameService } from "./game.service";

const AI_SKILLS: Record<string, number> = {
    "sciences": 0.70,
    "culture-generale": 0.60,
    "divertissement": 0.60,
    "histoire-geo": 0.40,
    "default": 0.50
};

export class AIService {
    constructor(private readonly gameservice: GameService) {}

    public async generateAIAnswer(gameState: GameState, aiId: string): Promise<void> {
        if (gameState.isFinished) 
            return;

        const currentQuestionIndex = gameState.currentQuestionIndex;
        const currentQuestion = gameState.questions[currentQuestionIndex];
        if (!currentQuestion) {
            console.warn(`[IA] Question introuvable pour la partie ${gameState.gameId}`);
            return;
        }

        const aiPlayer = gameState.players[aiId];
        if (!aiPlayer || !aiPlayer.isAI) {
            console.warn(`[IA] Joueur IA introuvable (${aiId}) pour la partie ${gameState.gameId}`);
            return;
        }

        const correctAnswerIndex = currentQuestion.correctAnswerIndex;
        const totalOptions = currentQuestion.options.length;
        const category = (gameState.category || "default").toLowerCase();
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

        const thinkingTime = Math.floor(Math.random() * (6000 - 2000 + 1)) + 2000;

        setTimeout(async () => {
            try {
                await this.gameservice.submitAnswer(gameState.gameId, selectedAnswerIndex, aiId);
            } catch (error) {
                console.error("[IA] Erreur:", error);
            }
        }, thinkingTime);
    }
}
