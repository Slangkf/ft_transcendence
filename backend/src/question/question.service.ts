import { Question as PrismaQuestion } from '@prisma/client';
import { PublicQuestion, Question } from "game/game.types";
import { QuestionRepository } from "./question.repository";

export class QuestionService{
    private availableQuizIds: number[] = [];
    constructor(private  repo: QuestionRepository){}

    async pickNextQuizId(): Promise<number | null>{
        if (this.availableQuizIds.length === 0){
            const ids = await this.repo.get_all_QuizIds();
            if (ids.length === 0) return null;

            this.availableQuizIds = ids.sort(()=> Math.random() - 0.5);
        }
        return this.availableQuizIds.shift()!;
    }

    async fetchQuizQuestions(quizId: number): Promise<Question[] | null>
    {
        const quiz = await this.repo.get_Quiz_withquestions(quizId);
        if (!quiz || quiz.questions.length === 0)
            return null;

        return quiz.questions.map((q: PrismaQuestion) => ({
            id: q.id,
            question: q.text,
            options: q.options,
            correctAnswerIndex: q.options.findIndex(opt => opt === q.answer),
        }));
    }
    toPublicQuestion(question: Question): PublicQuestion
    {
        return {
            id: question.id,
            question: question.question,
            options: question.options,
        };
    }
}

/***
 *  1. get questions random 
 *  2. get questions random of one category
 *  3. check answer? 
 *  4. 
 */