import { randomUUID } from 'crypto';
import { GameInfo, GameState, IModeService, PublicGameState, StartGameResult,
    Player,PublicPlayer} from "../game.types"
import { GameBaseService } from '../game.base';
import { AppError } from 'src/error/apperror';

export class SoloService extends GameBaseService implements IModeService
{
    public async startGame(userId: string): Promise<StartGameResult | null>
    {
        const quizId = await this.questionService.pickNextQuizId();
        if (quizId === null)
            return null;

        const questions = await this.questionService.fetchQuizQuestions(quizId);
        if (!questions || questions.length === 0)
            throw new AppError('no questions', 404);
        
        const gameId = randomUUID();
        const gameState: GameState = {
            gameId: gameId,
            mode: 'solo',
            questions: questions,
            players: {
                [userId]: {
                    id: userId,
                    score: 0,
                    answers: []
                }
            },
            currentQuestionIndex: 0,
            isFinished: false,
        };

        await this.gameRepository.create(gameState);

        return {
            gameId,
            question: this.questionService.toPublicQuestion(questions[0]),
        };
    }

    public async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameInfo | null>
    {
        const gameState = await this.gameRepository.findById(gameId);

        if (!gameState)
            throw new AppError('Gamestate not find', 404);

        const toPublicPlayer = (players: Record<string, Player>): Record<string, PublicPlayer> => {
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
        const toPublicState = (state: GameState): PublicGameState =>({
            gameId: state.gameId,
            players: toPublicPlayer(state.players),
            currentQuestionIndex: state.currentQuestionIndex,
            isFinished: state.isFinished,
            totalQuestions: state.questions.length,
        })
        if (gameState.isFinished)
        {
            return {
                gameresult: toPublicState(gameState),
                correctAnswer: '',
                nextQuestion: null,
            };
        }
        const currentQuestion = gameState.questions[gameState.currentQuestionIndex] ?? null;

        if (!currentQuestion)
        {
            gameState.isFinished = true;
            await this.gameRepository.update(gameState);

            return {
                gameresult:toPublicState(gameState),
                correctAnswer: '',
                nextQuestion: null,
            };
        }

        const player = gameState.players[userId];
        if (!player) throw new AppError('player not find', );

        if (selectedAnswerIndex < 0 || selectedAnswerIndex >= currentQuestion.options.length){
             throw new AppError('Index answer error', 400);
        }
        const isCorrect = selectedAnswerIndex === currentQuestion.correctAnswerIndex;

        if (isCorrect)
            player.score += 1;

        player.answers.push({
            questionId: currentQuestion.id,
            selectedAnswerIndex,
            isCorrect,
        })
        const correctAnswer = currentQuestion.options[currentQuestion.correctAnswerIndex] ?? '';

        gameState.currentQuestionIndex += 1;

        if (gameState.currentQuestionIndex >= gameState.questions.length)
        {
            gameState.isFinished = true;
            await this.gameRepository.update(gameState);

            return {
                gameresult:toPublicState(gameState),
                correctAnswer,
                nextQuestion: null,
            };
        }

        const nextQuestion = gameState.questions[gameState.currentQuestionIndex];

        if (!nextQuestion)
        {
            gameState.isFinished = true;
        }

        await this.gameRepository.update(gameState);

        return {
            gameresult:toPublicState(gameState),
            correctAnswer,
            nextQuestion: nextQuestion? this.questionService.toPublicQuestion(nextQuestion) : null,
        };
    }
}
