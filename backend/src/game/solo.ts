import { GameMode, GameUpdateResponse, Player, BaseGameState } from "./game.types";
import { GameBaseService } from "./game.base";
import { RedisGameRepository } from "./game.redis.repository";
import { QuestionService } from "../question/question.service";
import { AppError, ErrorCode } from "../error/apperror";


export class SoloService extends GameBaseService{
    protected gamerepository: RedisGameRepository;

    constructor(
        questionservice: QuestionService,
        gamerepository: RedisGameRepository,
    ){
        super(questionservice);
        this.gamerepository = gamerepository;
    }

    async startGame(userId: string, nickname: string, mode: GameMode.SOLO | GameMode.AI, category?: string): Promise<BaseGameState>{
        const players = {[userId]: this.initPlayers(userId, nickname)};
        const state = await this.prepareGame(players, mode, { category });
        await this.gamerepository.create(state);
        return state;
    }

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<{state: BaseGameState;
        lastAnswer: { playerId: string; isCorrect: boolean; correctAnswerIndex: number; correctText: string };
    }>{
        const state = await this.gamerepository.findById(gameId);
        if (!state) throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
        if (state.isFinished) throw new AppError('Game is already finished', ErrorCode.GAME_ALREADY_FINISHED, 400);
        
        const player = state.players[userId];
        if (!player) throw new AppError('Player not found', ErrorCode.PLAYER_NOT_FOUND, 404);
        if (player.status === 'answered') throw new AppError('Player already answered', ErrorCode.PLAYER_ALREADY_ANSWERED, 400);

        const lastAnswer = await this.processAnswer(state, selectedAnswerIndex, userId);
        const allAnswered = Object.values(state.players)
            .filter((p: Player) => !p.isAI || state.mode === GameMode.AI)
            .every((p: Player) => p.status === 'answered');

        if (allAnswered) this.advanceGame(state);
    
        await this.gamerepository.update(state);
        return {state, lastAnswer};
    }
}