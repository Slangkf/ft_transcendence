import { AppError, ErrorCode } from "src/error/apperror";
import { IGameRepository } from "src/g/game.redis.repository";
import { QuestionService } from "src/question/question.service";
import { Room } from "src/room/room.types";
import { GameBaseService } from "./game.base";
import { GameMode, GameUpdateResponse, Player } from "./game.types";

export class LocalMultiPlayer extends GameBaseService {
    protected gamerepository: IGameRepository;

    constructor(
        questionservice: QuestionService,
        gamerepo: IGameRepository,
    ){
        super(questionservice);
        this.gamerepository = gamerepo;
    }

    async startGame(room: Room): Promise<GameUpdateResponse>{
        const playerlist = Object.values(room.players);
        if (playerlist.length < 2) throw new AppError('Not enough players', ErrorCode.ROOM_PLAYER_NBR, 400);
        
        const players: Record<string, Player> = {};
        
        for(const p of playerlist){
            players[p.id] = this.initPlayers(p.id, p.nickname);
        }
        const state = await this.prepareGame(players, GameMode.MULTIPLAYER);
        (state as any).roomId = room.roomId;
        (state as any).hostId = room.hostId;
        (state as any).status = 'playing';

        await this.gamerepository.create(state);
        return {
            ...this.buildResponseForFront(state)
        }
    }

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameUpdateResponse>{
        const state = await this.gamerepository.findById(gameId);
        if (!state) throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
        if (state.isFinished) throw new AppError('Game is already finished', ErrorCode.GAME_ALREADY_FINISHED, 400);
        
        const lastAnswerUpdate = await this.processAnswer(state, selectedAnswerIndex, userId);
        const allAnswered = Object.values(state.players)
            .filter((p: Player) => p.status !== 'disconnected')
            .every((p: Player) => p.status === 'answered');

        if (allAnswered) this.advanceGame(state);
        await this.gamerepository.update(state);
    
        const response = this.buildResponseForFront(state);
        return {...response, lastAnswerUpdate};
    }
}