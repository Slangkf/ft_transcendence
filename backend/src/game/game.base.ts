import { QuestionService } from "src/question/question.service";
import { IGameRepository, Player, PublicPlayer, SoloGameState, MultiGameState, GameState, PublicGameState, PlayerAnswer } from "./game.types";
import { randomUUID } from 'crypto';
import { GameInfo, GameState, IModeService, PublicGameState, StartGameResult,
    Player,PublicPlayer} from "../game.types"
import { AppError, ErrorCode } from "src/error/apperror";

export class GameBaseService 
{
    constructor(
        protected  gameRepository: IGameRepository,
        protected readonly questionService: QuestionService
    ){}
    protected  toPublicPlayer (players: Record<string, Player>): Record<string, PublicPlayer> {
            return Object.fromEntries(
                Object.entries(players).map(([id, player]) => [
                    id,
                    {
                        id: player.id,
                        score: player.score,
                        isAI: player.isAI,
                    }
                ])
            );
        };
    protected toPublicState (state: GameState): PublicGameState {
        return {
            gameId: state.gameId,
            players: this.toPublicPlayer(state.players),
            currentQuestionIndex: state.currentQuestionIndex,
            isFinished: state.isFinished,
            totalQuestions: state.questions.length,}
        }
    protected async prepareGame(
        players: Record<string, Player>,
        mode: 'solo' | 'IA',
        options?: { totalQuestions?: number }): Promise<SoloGameState>

    protected async prepareGame(
        players: Record<string, Player>,
        mode: 'multiplayer',
        options: { totalQuestions?: number; roomId: string; hostId: string }): Promise<MultiGameState>
    
    protected async prepareGame(
        players: Record<string, Player>,
        mode: 'solo' | 'IA' | 'multiplayer',
        options?: { totalQuestions?: number; roomId?: string; hostId?: string }): Promise<GameState> {
            const questions = await this.questionService.getQuestions(options?.totalQuestions ?? 10);
            const base = {
              gameId: randomUUID(),
              players,
              questions,
              currentQuestionIndex: 0,
              isFinished: false,
              startedAt: new Date(),
            };
        
            if (mode === 'multiplayer') {
              return { ...base, mode, roomId: options!.roomId!, hostId: options!.hostId! };
            }
            return { ...base, mode };
        }
    protected validateAnswer(state: GameState, selectedIndex: number, userId: string): {isCorrect: boolean; correctIndex: number}{
            const question = state.questions[state.currentQuestionIndex] ?? null;
            if (!question) throw new AppError(
                "question not found",
                ErrorCode.QUESTION_NOT_FOUND,
            );

            const isCorrect = selectedIndex === question.correctAnswerIndex;
            const answer: PlayerAnswer = {
                questionId: question.id,
                selectedAnswerIndex: selectedIndex,
                isCorrect,
                answeredAt: Date.now(),
            }
            const player = state.players[userId];
            if (!player) throw new AppError(
                'player not find',
                ErrorCode.PLAYER_NOT_FOUND,
                400);
            player.answers.push(answer);
            player.status = "answered";

            return {isCorrect, correctIndex: question.correctAnswerIndex};
    }

    protected advance(state: GameState): void{
        state.currentQuestionIndex += 1;
        state.isFinished = state.currentQuestionIndex >= state.questions.length;

        if (!state.isFinished){
            for(const player of Object.values(state.players)){
                player.status = 'playing'
            }
        }
    }

    protected buildGameInfo(state: GameState): GameInfo{
        const answeredIndex = state.currentQuestionIndex -1;
        const answeredQuestion = state.state.questions[answeredIndex];
        const correctAnswer = answeredQuestion.options[answeredQuestion.correctAnswerIndex];
 
        const nextQuestion = state.isFinished
          ? null
          : this.questionService.toPublicQuestion(state.questions[state.currentQuestionIndex]);
        
        return {
          gameresult: this.toPublicState(state),
          correctAnswer,
          nextQuestion,
        };
    }
    protected buildPlayer(id: string, opts?: { isAI?: boolean; joinOrder?: number }): Player {
        return {
          id,
          score: 0,
          answers: [],
          status: 'playing',
          isAI: opts?.isAI ?? false,
          joinOrder: opts?.joinOrder,
          lastActiveAt: Date.now(),
        };
    }
}

/**
 * Game base: 
 * 1. prepare questions
 * 2. use the different repository for different service, only redis now
 * 3. need a step to save the result in database（ every service have to give back the result of the game)
 * 4. 
 */
