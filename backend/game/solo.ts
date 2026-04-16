import { randomUUID } from 'crypto';
import { AnswerResult, GameState, IModeService, StartGameResult } from './game.types';
import { GameService } from './game.service';

export class SoloService extends GameService implements IModeService
{
    public async startGame(): Promise<StartGameResult | null>
    {
        const quizId = await this.pickNextQuizId();
        if (quizId === null)
            return null;

        const questions = await this.fetchQuizQuestions(quizId);
        if (!questions)
            return null;

        const firstQuestion = questions[0];
        if (!firstQuestion)
            return null;

        const gameId = randomUUID();
        const gameState: GameState = {
            id: gameId,
            currentQuestionIndex: 0,
            score: 0,
            isFinished: false,
        };

        this.gameRepository.create(gameState);
        this.gameQuestions.set(gameId, questions);

        return {
            gameId,
            question: this.toPublicQuestion(firstQuestion),
        };
    }

    public submitAnswer(gameId: string, selectedAnswerIndex: number): AnswerResult | null
    {
        const gameState = this.gameRepository.findById(gameId);

        if (!gameState)
            return null;

        const questions = this.gameQuestions.get(gameId) ?? [];

        if (gameState.isFinished)
        {
            this.gameQuestions.delete(gameId);
            this.gameRepository.delete(gameId);
            return {
                isCorrect: false,
                correctAnswer: '',
                nextQuestion: null,
                score: gameState.score,
                isFinished: true,
            };
        }

        const currentQuestion = questions[gameState.currentQuestionIndex] ?? null;

        if (!currentQuestion)
        {
            gameState.isFinished = true;
            this.gameRepository.update(gameState);
            this.gameQuestions.delete(gameId);
            this.gameRepository.delete(gameId);

            return {
                isCorrect: false,
                correctAnswer: '',
                nextQuestion: null,
                score: gameState.score,
                isFinished: true,
            };
        }

        const isCorrect = selectedAnswerIndex === currentQuestion.correctAnswerIndex;

        if (isCorrect)
            gameState.score += 1;

        const correctAnswer = currentQuestion.options[currentQuestion.correctAnswerIndex] ?? '';

        gameState.currentQuestionIndex += 1;

        if (gameState.currentQuestionIndex >= questions.length)
        {
            gameState.isFinished = true;
            this.gameRepository.update(gameState);
            this.gameQuestions.delete(gameId);
            this.gameRepository.delete(gameId);

            return {
                isCorrect,
                correctAnswer,
                nextQuestion: null,
                score: gameState.score,
                isFinished: true,
            };
        }

        const nextQuestion = questions[gameState.currentQuestionIndex];

        if (!nextQuestion)
        {
            gameState.isFinished = true;
            this.gameRepository.update(gameState);
            this.gameQuestions.delete(gameId);
            this.gameRepository.delete(gameId);

            return {
                isCorrect,
                correctAnswer,
                nextQuestion: null,
                score: gameState.score,
                isFinished: true,
            };
        }

        this.gameRepository.update(gameState);

        return {
            isCorrect,
            correctAnswer,
            nextQuestion: this.toPublicQuestion(nextQuestion),
            score: gameState.score,
            isFinished: false,
        };
    }
}
