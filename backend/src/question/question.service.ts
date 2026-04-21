import { Question as PrismaQuestion } from '@prisma/client';
import { PublicQuestion, Question } from "game/game.types";
import { QuestionRepository } from "./question.repository";
import { AppError, ErrorCode } from 'src/error/apperror';


export class QuestionService{
    private availableQuizIds: number[] = [];
    constructor(private  repo: QuestionRepository){}

    async getQuestions(total: number = 10): Promise<Question[]> {
    // 每次调用都从数据库拿所有 id，随机挑一个
    // 不依赖内存状态，天然无竞争
    const allIds = await this.repo.get_all_QuizIds();
    if (allIds.length === 0) throw new AppError(
        'No quiz available', 
        ErrorCode.QUESTION_NOT_FOUND);

    // 随机选一个 quizId
    const randomId = allIds[Math.floor(Math.random() * allIds.length)];
    const questions = await this.fetchQuizQuestions(randomId);
    if (!questions) throw new AppError(
        'Quiz not found',
         ErrorCode.QUESTION_NOT_FOUND);

    // 题目数量不够就全拿，够的话随机抽 total 道
    return questions
      .sort(() => Math.random() - 0.5)
      .slice(0, total);
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