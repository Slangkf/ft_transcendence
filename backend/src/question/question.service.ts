import { Question as PrismaQuestion } from '@prisma/client';
import { QuestionRepository } from "./question.repository";
import { AppError, ErrorCode } from '../error/apperror';
import { PublicQuestion } from '@shared/game.schema';
import { GameQuestion } from '../game/game.types';


export class QuestionService{
    constructor(private  repo: QuestionRepository){}

    async getQuestions(total: number = 10, category?: string): Promise<GameQuestion[]> {
        const questions = await this.repo.get_questions_byCategory(category);
        if (questions.length === 0) throw new AppError(
            category ? `No quiz available for category "${category}"` : 'No quiz available',
            ErrorCode.QUESTION_NOT_FOUND);

        const requestedTotal = Math.max(1, Math.floor(total));
        return this.shuffle(questions)
            .slice(0, requestedTotal)
            .map(question => this.toGameQuestion(question));
    }

    async getCategories(): Promise<string[]> {
        return this.repo.get_all_Categories();
    }

    async fetchQuizQuestions(quizId: number): Promise<GameQuestion[] | null>
    {
        const quiz = await this.repo.get_Quiz_withquestions(quizId);
        if (!quiz || quiz.questions.length === 0)
            return null;

        return this.shuffle(quiz.questions).map((q: PrismaQuestion) => this.toGameQuestion(q));
    }

    private toGameQuestion(question: PrismaQuestion): GameQuestion {
        const shuffledOptions = this.shuffle(question.options);
        return {
            id: question.id,
            question: question.text,
            options: shuffledOptions,
            correctAnswerIndex: shuffledOptions.findIndex(opt => opt === question.answer),
        };
    }

    private shuffle<T>(items: readonly T[]): T[] {
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    toPublicQuestion(question: GameQuestion): PublicQuestion
    {
        return {
            id: question.id,
            question: question.question,
            options: question.options,
        };
    }
}
