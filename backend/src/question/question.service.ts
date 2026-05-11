import { Question as PrismaQuestion } from '@prisma/client';
import { PublicQuestion, Question } from "game/game.types";
import { QuestionRepository } from "./question.repository";
import { AppError, ErrorCode } from 'src/error/apperror';


export class QuestionService{
    private availableQuizIds: number[] = [];
    constructor(private  repo: QuestionRepository){}

    async getQuestions(total: number = 10, category?: string): Promise<Question[]> {
    const allIds = category
        ? await this.repo.get_QuizIds_byCategory(category)
        : await this.repo.get_all_QuizIds();
    if (allIds.length === 0) throw new AppError(
        category ? `No quiz available for category "${category}"` : 'No quiz available',
        ErrorCode.QUESTION_NOT_FOUND);

    const randomId = allIds[Math.floor(Math.random() * allIds.length)];
    const questions = await this.fetchQuizQuestions(randomId);
    if (!questions) throw new AppError(
        'Quiz not found',
         ErrorCode.QUESTION_NOT_FOUND);

    return questions
      .sort(() => Math.random() - 0.5)
      .slice(0, total);
  }

    async getCategories(): Promise<string[]>{
        return this.repo.get_all_Categories();
    }

    async fetchQuizQuestions(quizId: number): Promise<Question[] | null>
    {
        const quiz = await this.repo.get_Quiz_withquestions(quizId);
        if (!quiz || quiz.questions.length === 0)
            return null;

        return quiz.questions.map((q: PrismaQuestion) => {
            const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
            return {
                id: q.id,
                question: q.text,
                options: shuffledOptions,
                correctAnswerIndex: shuffledOptions.findIndex(opt => opt === q.answer),
            };
        });
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
