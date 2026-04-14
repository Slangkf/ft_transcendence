import { randomUUID } from 'crypto';
import questionsData from './questions.json';
import {
  AnswerResult,
  GameState,
  PublicQuestion,
  Question,
  StartGameResult,
} from './game.types';
import { GameRepository } from './game.repository';

export class GameService
{
    private readonly questions: Question[];

    constructor(private readonly gameRepository: GameRepository)
    {
        this.questions = questionsData as Question[];
    }

    private toPublicQuestion(question: Question): PublicQuestion
    {
        return {
            id: question.id,
            question: question.question,
            options: question.options,
        };
    }

    public startGame(): StartGameResult | null
    {
        const firstQuestion = this.questions[0];
    
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

        if (gameState.isFinished)
        {
            return {
                isCorrect: false,
                correctAnswer: '',
                nextQuestion: null,
                score: gameState.score,
                isFinished: true,
            };
        }

        const currentQuestion = this.questions[gameState.currentQuestionIndex] ?? null;

        if (!currentQuestion)
        {
            gameState.isFinished = true;
            this.gameRepository.update(gameState);

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

        if (gameState.currentQuestionIndex >= this.questions.length)
        {
            gameState.isFinished = true;
            this.gameRepository.update(gameState);

            return {
                isCorrect,
                correctAnswer,
                nextQuestion: null,
                score: gameState.score,
                isFinished: true,
            };
        }

        const nextQuestion = this.questions[gameState.currentQuestionIndex];

        if (!nextQuestion)
        {
            gameState.isFinished = true;
            this.gameRepository.update(gameState);
        
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
