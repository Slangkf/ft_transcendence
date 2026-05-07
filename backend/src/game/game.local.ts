import { AppError, ErrorCode } from "src/error/apperror";
import { IGameRepository } from "src/g/types";
import { QuestionService } from "src/question/question.service";
import { Room } from "src/room/room.types";
import { GameBaseService } from "./game.base";
import { GameMode, GameUpdateResponse, Player } from "./game.types";
import { object } from "zod/v4";


export class LocalMultiPlayer extends GameBaseService {
    constructor(
        questionservice: QuestionService,
        gamerepo: IGameRepository,
    ){
        super(questionservice);
    }

    async startGame(room: Room): Promise<GameUpdateResponse>{
        if (room.players.length < 2) throw new AppError('Not enough players', ErrorCode.ROOM_PLAYER_NBR, 400);
        
        const playerlist = Object.values(room.players);
        const players: Record<string, Player> = {};
        
        for(const p of playerlist){
            players[p.id] = this.initPlayers(p.id, p.username);
        }
        const state = await this.prepareGame(players, GameMode.MULTIPLAYER);
        state.roomId = room.roomId;

        await this.gamerepo.create(state);
        return {
            ...this.buildResponseForFront(state)
        }
    }

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameUpdateResponse>{
        const state = await this.gamerepo.findById(gameId);
        if (!state) throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
        if (state.isFinished) throw new AppError('Game is already finished', ErrorCode.GAME_ALREADY_FINISHED, 400);
        
      const lastAnswerUpdate = await this.processAnswer(state, selectedAnswerIndex, userId);
      const allAnswered = Object.values(state.players)
            .filter(p => p.status !== 'disconnected')
            .every(p => p.status === 'answered');

        if (allAnswered) this.advanceGame(state);
        await this.gamerepo.update(state);
    
        const response = this.buildResponseForFront(state);
        return {...response, lastAnswerUpdate};


/****
 * 
 * 
 * only logic of multiplayer game 
 */