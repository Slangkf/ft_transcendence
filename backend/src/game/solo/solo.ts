import { randomUUID } from 'crypto';
import { GameInfo, GameState, IModeService, StartGameResult } from "../game.types"
import { GameBaseService } from '../game.base';

export class SoloService extends GameBaseService implements IModeService
{
    public async startGame(userId: string): Promise<StartGameResult | null>
    {
        const quizId = await this.questionService.pickNextQuizId();
        if (quizId === null)
            return null;

        const questions = await this.questionService.fetchQuizQuestions(quizId);
        if (!questions || questions.length === 0)
            return null;
        const publicquestions = questions.map(toPublicQuestion);
        
        const gameId = randomUUID();
        const gameState: GameState = {
            id: gameId,
            questions: publicquestions,
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
            return null;

        if (gameState.isFinished)
        {
            return {
                gameresult:gameState,
                correctAnswer: '',
                nextQuestion: null,
            };
        }
        const questions = gameState.questions;
        const currentQuestion = questions[gameState.currentQuestionIndex] ?? null;

        if (!currentQuestion)
        {
            gameState.isFinished = true;
            await this.gameRepository.update(gameState);

            return {
                gameresult:gameState,
                correctAnswer: '',
                nextQuestion: null,
            };
        }

        const player = gameState.players[userId];
        if (!player) return null;

        if (selectedAnswerIndex < 0 || selectedAnswerIndex >= currentQuestion.options.length){
            return null;
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

        if (gameState.currentQuestionIndex >= questions.length)
        {
            gameState.isFinished = true;
            await this.gameRepository.update(gameState);

            return {
                gameresult:gameState,
                correctAnswer,
                nextQuestion: null,
            };
        }

        const nextQuestion = questions[gameState.currentQuestionIndex];

        if (!nextQuestion)
        {
            gameState.isFinished = true;
            await this.gameRepository.update(gameState);

            return {
                gameresult:gameState,
                correctAnswer,
                nextQuestion: null,
            };
        }

        await this.gameRepository.update(gameState);

        return {
            gameresult:gameState,
            correctAnswer,
            nextQuestion: this.questionService.toPublicQuestion(nextQuestion),
            isFinished: false,
        };
    }
}
