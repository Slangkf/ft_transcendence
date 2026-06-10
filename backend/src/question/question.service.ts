import { Question as PrismaQuestion } from '@prisma/client';
import { QuestionRepository } from "./question.repository";
import { AppError, ErrorCode } from '../error/apperror';
import { PublicQuestion } from '@shared/game.schema';
import { GameQuestion } from '../game/game.types';

/**
 * @class QuestionService
 * @description service for quiz question management.
 * responsabilites: 
 * - retireve questions from the repository
 * - filter questions by category
 * - randomize question order
 * - randomize answer options
 * - convert database entities into game-ready questions
 * - expose public question data without answers 
 */
export class QuestionService{
    constructor(private  repo: QuestionRepository){}

    /**
     * @method getQuestions
     * @description if a category is provided, only questions belonging to that 
     *  category are considered.
     * The returned questions are shuffled and limited
     * to the requested amount.
     * @param total Number of questions requested
     * @param category Optional category filter
     * @returns Game-ready questions with shuffled answers
     * @throws AppError when no questions are available
     */
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

    /* Returns the distinct list of quiz categories. */
    async getCategories(): Promise<string[]> {
        return this.repo.get_all_Categories();
    }

    /* Returns a specific quiz's questions (shuffled, game-ready), or null if empty/unknown. */
    async fetchQuizQuestions(quizId: number): Promise<GameQuestion[] | null>
    {
        const quiz = await this.repo.get_Quiz_withquestions(quizId);
        if (!quiz || quiz.questions.length === 0)
            return null;

        return this.shuffle(quiz.questions).map((q: PrismaQuestion) => this.toGameQuestion(q));
    }

    /**
     * @method toGameQuestion
     * @description couvert a database question into a game question
     *  the answer options are randomized and the 
     *  correct answer index is recalculated accordingly
     * @param question 
     * @returns Question formatted for gameplay
     */
    private toGameQuestion(question: PrismaQuestion): GameQuestion {
        const shuffledOptions = this.shuffle(question.options);
        return {
            id: question.id,
            question: question.text,
            options: shuffledOptions,
            correctAnswerIndex: shuffledOptions.findIndex(opt => opt === question.answer),
        };
    }

    /**
     * Creates a new array without mutating the original.
     * @param items 
     * @returns 
     */
    private shuffle<T>(items: readonly T[]): T[] {
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * @method toPublicQuestion
     * @description convert a game question into a public version
     * the correct answer information is removed before sending the question
     * to clients. 
     * @param question 
     * @returns Public question 
     */
    toPublicQuestion(question: GameQuestion): PublicQuestion
    {
        return {
            id: question.id,
            question: question.question,
            options: question.options,
        };
    }
}
