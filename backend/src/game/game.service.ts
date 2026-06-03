import { AppError, ErrorCode } from "../error/apperror";
import { QuestionService } from "../question/question.service";
import { GameMapper } from "./game.mapper";
import { MultiPlayerFacade } from "./game.multi";
import { RedisGameRepository } from "./game.redis.repository";
import { PrismaGameRepository } from "./game.score";
import { BaseGameState, GameState, GameUpdateResponse, MatchPlayer, MatchResult, SetReadyResult, StartGameParams } from "./game.types";
import { SoloService } from "./solo";

export type GameStartResult = GameUpdateResponse | {status: 'waiting' | 'matched'; players?: any[]; roomId?: string};

export class GameService{
    constructor(
        private soloservice: SoloService,
        private multiplayer: MultiPlayerFacade,
        private gameRepository: RedisGameRepository,
        private questionService: QuestionService,
        private db: PrismaGameRepository, //save into database
        private mapper: GameMapper // prepare the response for front and in database 
    ){}

    async listCategories(): Promise<string[]> {
        return this.questionService.getCategories();
    }

    async startGame(params:StartGameParams): Promise<GameUpdateResponse | { status: 'matched' | 'waiting'; roomId?: string; players?: MatchPlayer[] }>{
        const {mode, userId, nickname, category, size} = params;

        switch(mode){
            case "SOLO":
            case "AI":
                const state = await this.soloservice.startGame(userId, nickname, mode, category);
                return this.mapper.toUpdateResponse(state);
            case "MULTIPLAYER":
                const result =  await this.multiplayer.joinMatchmaking("MULTIPLAYER", userId, nickname, size);
                return {
                    status: result.status,
                    roomId: result.roomId,
                    players: result.players,
                };
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

        let state: BaseGameState;
        let lastAnswer: any;

        if (gameState.mode === "MULTIPLAYER") {
            ({state, lastAnswer} = await this.multiplayer.submitAnswer(gameId, selectedAnswerIndex, userId));
        } else {
            ({state, lastAnswer} = await this.soloservice.submitAnswer(gameId, selectedAnswerIndex, userId));
        }

        return this.mapper.toUpdateResponse(state, lastAnswer);
    }

    async setReady(roomId: string, userId: string, isReady: boolean): Promise<SetReadyResult>{
        return this.multiplayer.setPlayerReady(roomId, userId, isReady);
    }

    async finalize(gameId: string): Promise<void> {
        const state = await this.gameRepository.findById(gameId);
        if (!state || !state.isFinished) return;
        const matchResult = this.mapper.toMatchResult(state);
        await this.db.create(matchResult);
        await this.gameRepository.delete(state.gameId);
        if (state.mode === 'MULTIPLAYER'){
            const roomId = state.roomId;
            if (state.tournamentId){
                // Tournament matches: the TournamentService owns the player session
                // lifecycle (promote winner to next match / spectator / finish).
                // Only drop the finished match room — never reset sessions here,
                // otherwise the winner already advanced to the next match is
                // clobbered back to 'idle'.
                if (roomId) await this.multiplayer.disbandRoom(roomId);
            } else if (roomId){
                const userIds = Object.keys(state.players);
                await this.multiplayer.cleanupRoom(roomId, userIds);
            }
        }
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