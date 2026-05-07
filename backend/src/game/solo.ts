import { IGameRepository } from "src/g/game.redis.repository";
import { GameMode, GameUpdateResponse, Player, BaseGameState } from "./game.types";
import { QuestionService } from "src/question/question.service";
import { GameBaseService } from "./game.base";
import { AppError, ErrorCode } from "src/error/apperror";


export class SoloService extends GameBaseService{
    protected gamerepository: IGameRepository;

    constructor(
        questionservice: QuestionService,
        gamerepository: IGameRepository,
    ){
        super(questionservice);
        this.gamerepository = gamerepository;
    }

    async startGame(userId: string, nickname: string, mode: GameMode.SOLO | GameMode.AI): Promise<GameUpdateResponse>{
        const players = {[userId]: this.initPlayers(userId, nickname)};
        const state = await this.prepareGame(players, mode);
        await this.gamerepository.create(state);
        return {
            ...this.buildResponseForFront(state)
        }
    }

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameUpdateResponse>{
        const state = await this.gamerepository.findById(gameId);
        if (!state) throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
        if (state.isFinished) throw new AppError('Game is already finished', ErrorCode.GAME_ALREADY_FINISHED, 400);
        
        const player = state.players[userId];
        if (!player) throw new AppError('Player not found', ErrorCode.PLAYER_NOT_FOUND, 404);
        if (player.status === 'answered') throw new AppError('Player already answered', ErrorCode.PLAYER_ALREADY_ANSWERED, 400);

        const {isCorrect, correctAnswerIndex, correctText} = await this.processAnswer(state, selectedAnswerIndex, userId);
        const allAnswered = Object.values(state.players)
            .filter((p: Player) => !p.isAI || state.mode === GameMode.AI)
            .every((p: Player) => p.status === 'answered');

        if (allAnswered) this.advanceGame(state);
    
        const response = this.buildResponseForFront(state);
        response.lastAnswerUpdate = {
            isCorrect: isCorrect,
            correctAnswerIndex: correctAnswerIndex,
            correctText: correctText,
        }
        if (state.isFinished){
            await this.gamerepository.delete(gameId);
        } else {
            await this.gamerepository.update(state);
        }
        return response;
    }
}