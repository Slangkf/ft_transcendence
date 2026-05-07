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