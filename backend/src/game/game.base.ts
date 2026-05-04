import { QuestionService } from "src/question/question.service";
import { IGameRepository, PublicPlayer, SoloGameState, MultiGameState, GameState, PlayerAnswer, PlayingGameInfo, FinishedGameInfo } from "./game.types";
import { randomUUID } from 'crypto';
import { GameInfo, PublicGameState, Player, FinalScore} from "./game.types";
import { AppError, ErrorCode } from "src/error/apperror";

export class GameBaseService 
{
    constructor(
        protected  gameRepository: IGameRepository,
        protected readonly questionService: QuestionService
    ){}
    //prepare to start a game
    protected buildPlayer(id: string, opts?: { isAI?: boolean; joinOrder?: number }): Player {
        return {
          id,
          score: 0,
          answers: [],
          status: 'playing',
          Totaltime: 0,
          isAI: opts?.isAI ?? false,
          joinOrder: opts?.joinOrder,
        };
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
              startedAt: Date.now(),
            };
        
            if (mode === 'multiplayer') {
              return { ...base, mode, roomId: options!.roomId!, hostId: options!.hostId! };
            }
            return { ...base, mode };
        }
    //common to valide answer, and add the score in state
    protected validateAnswer(state: GameState, selectedIndex: number, userId: string): {isCorrect: boolean; correctIndex: number}{
        const question = state.questions[state.currentQuestionIndex] ?? null;
        if (!question) throw new AppError(
            "question not found",
            ErrorCode.QUESTION_NOT_FOUND,
            404,
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
            404);
        player.answers.push(answer);
        player.status = "answered";
        
        // Update score if answer is correct
        if (isCorrect) {
            player.score += 1;
        }
        
        return {isCorrect, correctIndex: question.correctAnswerIndex};
    }
    //advance to the next question
    protected advance(state: GameState): void{
        if (state.currentQuestionIndex + 1 >= state.questions.length){
            state.isFinished = true;
        } else { 
            state.currentQuestionIndex += 1;
            Object.values(state.players).forEach(p => {
                if (p.status !== 'disconnected')
                    p.status = 'playing'
            })
        }





        state.currentQuestionIndex += 1;
        state.isFinished = state.currentQuestionIndex >= state.questions.length;

        if (!state.isFinished){
            for(const player of Object.values(state.players)){
                player.status = 'playing'
            }
        }
    }
    //change player to PublicPlayer, prepare for the front reponse
    protected  toPublicPlayer (players: Record<string, Player>): Record<string, PublicPlayer> {
            return Object.fromEntries(
                Object.entries(players).map(([id, player]) => [
                    id,
                    {
                        id: player.id,
                        score: player.score,
                        isAI: player.isAI,
                        Totaltime: player.Totaltime,
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
    //get the final score for the front
    protected buildFinalScore(state: GameState){
        const players = Object.values(state.players);
        const winner = players.reduce((prev, current)=>{
            if (prev.score > current.score) return prev;
            if (prev.score < current.score) return current;

            return prev.Totaltime < current.Totaltime ? prev : current})

        return {
            gameId: state.gameId,
            players: this.toPublicPlayer(state.players),
            winner: winner.id,
            finishedAt: Date.now(),
        }
    }
    //gamestate information when is playing for front
    protected buildPlayingGameInfo(state: GameState): PlayingGameInfo{
        const answeredIndex = state.currentQuestionIndex -1;
        const answeredQuestion = state.questions[answeredIndex];
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
    //gamestate information when the game finished 
    protected buildfinishedGameInfo(state: GameState): FinishedGameInfo{
        return {
            gameresult: this.toPublicState(state),
            finalscore: this.buildFinalScore(state),
        }
    }
   
}

/**
 * Game base: 
 * 1. prepare questions
 * 2. use the different repository for different service, only redis now
 * 3. need a step to save the result in database（ every service have to give back the result of the game)
 * 4. 
 */
