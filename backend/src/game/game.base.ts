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
 * Game base: 
 * 1. prepare questions
 * 2. use the different repository for different service, only redis now
 * 3. need a step to save the result in database（ every service have to give back the result of the game)
 * 4. 
 */
