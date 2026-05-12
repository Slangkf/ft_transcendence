import { AppError, ErrorCode } from "src/error/apperror";
import { MultiPlayerFacade } from "./game.multi";
import { GameMode, GameState, GameUpdateResponse, SetReadyResult, StartGameParams, StartMultiResult } from "./game.types";
import { SoloService } from "./solo";
import { IGameRepository } from "src/game/game.redis.repository";

export type GameStartResult = GameUpdateResponse | {status: 'waiting' | 'matched'; players?: any[]; roomId?: string};

export class GameService{
    constructor(
        private soloservice: SoloService,
        private multiplayer: MultiPlayerFacade,
        private gameRepository: IGameRepository,
    ){}

    async startGame(params:StartGameParams): Promise<GameStartResult>{
        const {mode, userId, nickname} = params;

        switch(mode){
            case GameMode.SOLO:
                return this.soloservice.startGame(userId, nickname, GameMode.SOLO);
            case GameMode.MULTIPLAYER:
                return this.multiplayer.joinMatchmaking(GameMode.MULTIPLAYER, userId, nickname);
            default:
                throw new AppError(
                    "Unknown game mode",
                    ErrorCode.GAME_UNKOWN_MODE,
                    400
                )
        }
    }

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameUpdateResponse>{
            const gameState = await this.gameRepository.findById(gameId);
            
            if (!gameState) {
                throw new AppError(
                    'Game not found',
                    ErrorCode.GAME_NOT_FOUND,
                    404
                );
            }
            if (gameState.mode === GameMode.MULTIPLAYER) {
                return this.multiplayer.submitAnswer(gameId, selectedAnswerIndex, userId);
            } else {
                return this.soloservice.submitAnswer(gameId, selectedAnswerIndex, userId);
            }
    }

    async setReady(roomId: string, userId: string, isReady: boolean): Promise<SetReadyResult>{
        return this.multiplayer.setPlayerReady(roomId, userId, isReady);
    }

    buildResponseForFront(gamestate: GameState): GameUpdateResponse{
        if (gamestate.mode === GameMode.MULTIPLAYER)
            return this.multiplayer.buildResponseForFront(gamestate);
        return this.soloservice.buildResponseForFront(gamestate);
    }
}

/***
 *  the only entry for the game, need the response for the front 
 * 
 *  
 * 
 * 
 * 
 */