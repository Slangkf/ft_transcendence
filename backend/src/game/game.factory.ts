import { AppError, ErrorCode } from "src/error/apperror";
import { IModeService, StartGameParms, StartGameResult, GameInfo, StartMultiResult } from "./game.types";
import { Multiplayer } from "./multiplayer/multiplayer";
import { SoloService } from "./solo/solo";
import { IGameRepository } from "./game.types";

/**
 * Simple service router that delegates to appropriate game service based on mode.
 * Keeps SoloService and Multiplayer (MultiService) focused on their own logic.
 */
export class GameService {
    constructor(
        private soloService: SoloService,
        private multiplayer: Multiplayer,
        private gameRepository: IGameRepository
    ){}

    async startGame(params: StartGameParms): Promise<StartGameResult | StartMultiResult | null> {
        const {mode, userId, nickname} = params;

        switch(mode){
            case "solo":
                return this.soloService.startGame(params.userId);
            case "multiplayer":
                return this.multiplayer.joinMatchmaking(params);
            default:
                throw new AppError(
                    "Unknown game mode",
                    ErrorCode.GAME_UNKOWN_MODE,
                    400
                )
        }
    }

    /**
     * Route answer submission to appropriate service based on stored gameState mode.
     * No complex logic here - just simple routing.
     */
    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameInfo | null> {
        const gameState = await this.gameRepository.findById(gameId);
        
        if (!gameState) {
            throw new AppError(
                'Game not found',
                ErrorCode.GAME_NOT_FOUND,
                404
            );
        }

        // Simple routing: determine service based on mode stored in gameState
        if (gameState.mode === 'multiplayer') {
            return this.multiplayer.submitAnswer(gameId, selectedAnswerIndex, userId);
        } else {
            return this.soloService.submitAnswer(gameId, selectedAnswerIndex, userId);
        }
    }

    /**
     * Set player ready in multiplayer mode.
     * Returns StartGameResult if game starts, null if waiting for more players.
     */
    async setReady(roomId: string, userId: string, isReady: boolean): Promise<StartGameResult | null> {
        return this.multiplayer.setPlayerReady(roomId, userId, isReady);
    }
}