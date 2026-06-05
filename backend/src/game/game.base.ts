import { AppError, ErrorCode } from "../error/apperror";
import { QuestionService } from "../question/question.service";
import { Player, 
    BaseGameState, 
    GameUpdateResponse, 
    PlayerSnapShot, 
    FinalScore, 
    MultiGameState, SoloGameState, GameState, MatchResult } from "./game.types";

import {GameMode} from "@prisma/client";



export class GameBaseService
{
    constructor(
        protected readonly questionService: QuestionService,
    ){}

    public initPlayers(userId: string, nickname: string): Player {
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

    protected async prepareGame(players: Record<string, Player>, mode: GameMode, extra?: {roomId?: string, hostId?: string, category?: string, tournamentId?: string}): Promise<GameState> {
        const questions = await this.questionService.getQuestions(10, extra?.category);
        const gameId = crypto.randomUUID();
        const now = Date.now();
       // const hasAI = Object.values(players).some(p => p.isAI === true);
        const base = {
            gameId,
            mode,
            questions,
            players,
            currentQuestionIndex: 0,
            isFinished: false,
            startedAt: now,
            questionStartedAt: now,
            category: extra?.category
        }
        if (mode === "MULTIPLAYER" || mode === "TOURNAMENT" || mode === "AI"){
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
                tournamentId: extra.tournamentId,
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
        if (selectedIndex >= currentQuestion.options.length){
            throw new AppError(
                'Selected Answer Index problem',
                ErrorCode.BAD_REQUEST,
                400
            )
        };
        const isCorrect = selectedIndex === -1 ? false : (selectedIndex === currentQuestion.correctAnswerIndex);
        
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
            state.currentQuestionIndex++;
            state.questionStartedAt = Date.now();
            Object.values(state.players).forEach(p => {
                if (p.status !== 'disconnected')
                    p.status = 'playing';
            })
        }
    }

}
