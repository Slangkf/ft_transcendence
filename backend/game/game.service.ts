import { randomUUID } from 'crypto';
import { Question as PrismaQuestion } from '@prisma/client';
import prisma from '../lib/prisma';
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
    // questions stored per game so each game can have a different quiz
    private readonly gameQuestions = new Map<string, Question[]>();

    constructor(private readonly gameRepository: GameRepository) {}

    private toPublicQuestion(question: Question): PublicQuestion
    {
        return {
            id: question.id,
            question: question.question,
            options: question.options,
        };
    }

    public async startGame(): Promise<StartGameResult | null>
    {
        const count = await prisma.quiz.count();
        if (count === 0)
            return null;

        const skip = Math.floor(Math.random() * count);
        const quiz = await prisma.quiz.findFirst({
            skip,
            include: { questions: true },
        });

        if (!quiz || quiz.questions.length === 0)
            return null;

        const questions: Question[] = quiz.questions.map((q: PrismaQuestion) => ({
            id: q.id,
            question: q.text,
            options: q.options,
            correctAnswerIndex: q.options.indexOf(q.answer),
        }));

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
