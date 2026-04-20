import { QuestionService } from "src/question/question.service";
import { IGameRepository, Player, PublicPlayer, GameState, PublicGameState } from "./game.types";

export class GameBaseService 
{
    constructor(
        protected  gameRepository: IGameRepository,
        protected readonly questionService: QuestionService
    ){}
    protected  toPublicPlayer (players: Record<string, Player>): Record<string, PublicPlayer> {
            return Object.fromEntries(
                Object.entries(players).map(([id, player]) => [
                    id,
                    {
                        id: player.id,
                        score: player.score,
                        isAI: player.isAI,
                    }
                ])
            );
        };
    protected toPublicState (state: GameState): PublicGameState {
        return {
            gameId: state.gameId,
            players: this.toPublicPlayer(state.players),
            currentQuestionIndex: state.currentQuestionIndex,
            isFinished: state.isFinished,
            totalQuestions: state.questions.length,}
        }
}

/**
 * Game base: prepare questions
 * 
 * 
 * 
 */
