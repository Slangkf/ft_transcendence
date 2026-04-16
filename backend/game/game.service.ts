import { Question as PrismaQuestion } from '@prisma/client';
import prisma from '../lib/prisma';
import { PublicQuestion, Question } from './game.types';
import { GameRepository } from './game.repository';

export class GameService
{
    // questions stored per game so each game can have a different quiz
    protected readonly gameQuestions = new Map<string, Question[]>();

    // pool of quiz IDs not yet used in this cycle; refilled when empty
    protected availableQuizIds: number[] = [];

    constructor(protected readonly gameRepository: GameRepository) {}

    protected toPublicQuestion(question: Question): PublicQuestion
    {
        return {
            id: question.id,
            question: question.question,
            options: question.options,
        };
    }

    protected async pickNextQuizId(): Promise<number | null>
    {
        if (this.availableQuizIds.length === 0)
        {
            const quizzes = await prisma.quiz.findMany({ select: { id: true } });
            if (quizzes.length === 0)
                return null;
            // shuffle the full list to vary the order each cycle
            this.availableQuizIds = quizzes
                .map(q => q.id)
                .sort(() => Math.random() - 0.5);
        }

        return this.availableQuizIds.shift()!;
    }

    protected async fetchQuizQuestions(quizId: number): Promise<Question[] | null>
    {
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: { questions: true },
        });

        if (!quiz || quiz.questions.length === 0)
            return null;

        return quiz.questions.map((q: PrismaQuestion) => ({
            id: q.id,
            question: q.text,
            options: q.options,
            correctAnswerIndex: q.options.indexOf(q.answer),
        }));
    }
}
