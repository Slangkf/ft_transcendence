import {prisma} from '../lib/prisma';
import { Question } from '@prisma/client';

export class QuestionRepository{
    //1. get all question random
    async get_all_QuizIds(): Promise<number[]>{
        const quizzes = await prisma.quiz.findMany({
            select: {id: true},
        })
        return quizzes.map(q=> q.id);
    }

    async get_QuizIds_byCategory(category: string): Promise<number[]>{
        const quizzes = await prisma.quiz.findMany({
            where: {category},
            select: {id: true},
        })
        return quizzes.map(q => q.id);
    }

    async get_all_Categories(): Promise<string[]>{
        const rows = await prisma.quiz.findMany({
            select: {category: true},
            distinct: ['category'],
        })
        return rows.map(r => r.category).filter(Boolean).sort();
    }

    async get_questions_byCategory(category?: string): Promise<Question[]> {
        return prisma.question.findMany({
            where: category ? { quiz: { category } } : undefined,
        });
    }

    async get_Quiz_withquestions(quizId: number){
        return prisma.quiz.findUnique({
            where: {id: quizId},
            include: {questions: true},
        })
    }
}


/**
 * 1. get  questions random
 * 2. get  questions random of one category
 * 3. get question by id (prepare to check answer later)?
 * 4.
 *
 */
