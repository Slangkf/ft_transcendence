import { QuestionService } from "src/question/question.service";
import { Player, BaseGameState, GameUpdateResponse, PlayerSnapShot, FinalScore, GameMode, MultiGameState, SoloGameState, GameState } from "./game.types";
import { AppError, ErrorCode } from "src/error/apperror";
import { IGameRepository } from "src/game/game.redis.repository";


export class GameBaseService
{
    constructor(
        protected readonly questionService: QuestionService,
    ){}

    protected initPlayers(userId: string, nickname: string): Player {
        const player: Player = {
            id: userId,
            score: 0,
            answers: [],
            status: 'playing',
            Totaltime: 0,
            isAI: false,
            nickname: nickname,
        }
        return player;
    }

    protected async prepareGame(players: Record<string, Player>, mode: GameMode, extra?: {roomId: string, hostId: string}): Promise<GameState> {
        const questions = await this.questionService.getQuestions(10);
        const gameId = crypto.randomUUID();
        const base = {
            gameId,
            mode: mode,
            questions,
            players,
            currentQuestionIndex: 0,
            isFinished: false,
            startedAt: Date.now()
        }
        if (mode === GameMode.MULTIPLAYER || mode === GameMode.TOURNAMENT){
            if (!extra){
                throw new AppError(
                    'roomId and hostId required for multiplayer',
                    ErrorCode.GAME_UNKOWN_MODE,
                    400
                )
            }
            return {
                ...base,
                mode,
                roomId: extra.roomId,
                hostId: extra.hostId,
                status: 'playing',
            } as MultiGameState;
        } 
        return {
            ...base,
            mode,
        } as SoloGameState;
    }

    protected async processAnswer(state: BaseGameState, selectedIndex: number, userId: string): Promise<{playerId: string, isCorrect: boolean; correctAnswerIndex: number, correctText: string}> {

        const currentQuestion = state.questions[state.currentQuestionIndex];
        if (!currentQuestion){
            throw new AppError(
                'question not found',
                ErrorCode.QUESTION_NOT_FOUND,
                404
            )
        };
            const isCorrect = selectedIndex === currentQuestion.correctAnswerIndex;
            
            const player = state.players[userId];
            if (!player){
                throw new AppError(
                    'player not found',
                    ErrorCode.PLAYER_NOT_FOUND,
                    404
                );
            }
            player.answers.push({
                questionId: currentQuestion.id,
                selectedAnswerIndex: selectedIndex,
                isCorrect,
                answeredAt: Date.now()  
            })
            player.status = 'answered';

            if (isCorrect){
                player.score += 1;
            }

            return {playerId: userId, isCorrect, correctAnswerIndex: currentQuestion.correctAnswerIndex, correctText: currentQuestion.options[currentQuestion.correctAnswerIndex]};
    }

    protected advanceGame(state: BaseGameState): void {
        if (state.currentQuestionIndex + 1 >= state.questions.length){
            state.isFinished = true;
        } else {
            state.currentQuestionIndex += 1;
            Object.values(state.players).forEach(p => {
                if (p.status !== 'disconnected')
                    p.status = 'playing';
            })
        }
    }

    protected buildResponseForFront(state: BaseGameState): GameUpdateResponse{
        const isFinished = state.isFinished;
        const currentQuestion = state.questions[state.currentQuestionIndex];
        return {
            gameId: state.gameId,
            status: isFinished? "finished": "playing",
            state: {
                currentQuestionIndex: state.currentQuestionIndex,
                totalQuestions: state.questions.length,
                player: this.buildPublicPlayerSnapShot(state.players)
            },
            nextQuestion: isFinished? null : this.questionService.toPublicQuestion(currentQuestion),
            finalScore: isFinished? this.buildFinalScore(state.players) : null
        }
    }

    private buildPublicPlayerSnapShot(players: Record<string, Player>): Record<string, PlayerSnapShot> {
        return Object.fromEntries(
            Object.entries(players).map(([id, player]: [string, Player]) => [
                id,
                {
                    id: player.id,
                    score: player.score,
                    status: player.status,
                    isAI: player.isAI || false
                }
            ])
        )
    }

    private buildFinalScore(players: Record<string, Player>): FinalScore{
        const scores = Object.fromEntries(
            Object.entries(players).map(([id, player]: [string, Player]) => [
                id,
                player.score
            ])
        );
        const sorted = Object.entries(scores)
        .sort((a, b) => b[1] - a[1]);

        const ranking = sorted.map(([playerId, score], index) => ({
            playerId,
            score,
            rank: index + 1,
        }));

        const winnerId = ranking[0]?.playerId ?? "";
        return {
            winnerId,
            finishedAt: Date.now(),
            scores,
            ranking,
        }
    }

}