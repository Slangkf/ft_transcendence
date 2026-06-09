import { AppError, ErrorCode } from "../error/apperror";
import { QuestionService } from "../question/question.service";
import { AIService } from "./ai";
import { GameMapper } from "./game.mapper";
import { MultiPlayerFacade } from "./game.multi";
import { RedisGameRepository } from "./game.redis.repository";
import { PrismaGameRepository } from "./game.score";
import { BaseGameState, GameState, GameUpdateResponse, MatchPlayer, MatchResult, SetReadyResult, StartGameParams } from "./game.types";
import { SoloService } from "./solo";

export type GameStartResult = GameUpdateResponse | { status: 'waiting' | 'matched'; players?: any[]; roomId?: string };

/**
 * GameService (Core Orchestrator - Strategy 3 Unified Architecture Version)
 * Serves as the single-entry coordinator for the entire game lifecycle. Following Strategy 3, 
 * this service no longer manages any asynchronous timer scheduling for the AI. 
 * The AI's answer is evaluated and settled atomically via the lower-level LocalMultiPlayer 
 * and Lua scripts within the exact same millisecond that a human player submits their answer.
 */
export class GameService {
    constructor(
        private readonly soloservice: SoloService,
        private readonly multiplayer: MultiPlayerFacade,
        private readonly gameRepository: RedisGameRepository,
        private readonly questionService: QuestionService,
        private readonly db: PrismaGameRepository, 
        private readonly mapper: GameMapper,        
        private readonly aiservice: AIService
    ) {}

    async listCategories(): Promise<string[]> {
        return this.questionService.getCategories();
    }

    /**
     * Initializes and starts the matchmaking or game entry pipeline.
     */
    async startGame(params: StartGameParams): Promise<GameStartResult> {
        const { mode, userId, nickname, category, size } = params;

        switch (mode) {
            case "SOLO": {
                const state = await this.soloservice.startGame(userId, nickname, mode, category);
                return this.mapper.toUpdateResponse(state);
            }
            case "AI": {
                // Strategy 3 Architectural Shift:
                // During `createAIGame`, the internal initialization within `LocalMultiPlayer` prepares the 
                // initial AI snapshot for the first question (index 0) and commits it to Redis.
                // We no longer need to invoke the asynchronous `generateAIAnswer` method here. 
                // The AI silently waits for the player to submit the opening question.
                const state = await this.multiplayer.createAIGame(userId, nickname, category);
                return this.mapper.toUpdateResponse(state);
            }
            case "MULTIPLAYER": {
                const result = await this.multiplayer.joinMatchmaking("MULTIPLAYER", userId, nickname, size);
                return {
                    status: result.status,
                    roomId: result.roomId,
                    players: result.players,
                };
            }
            default:
                throw new AppError(
                    "Unknown game mode",
                    ErrorCode.GAME_UNKOWN_MODE,
                    400
                );
        }
    }

    /**
     * Core entry pipeline for human player answer submissions.
     */
    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string, expectedQuestionId?: number): Promise<GameUpdateResponse> {
        const gameState = await this.gameRepository.findById(gameId);
        if (!gameState) {
            throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
        }

        let state: BaseGameState;
        let lastAnswer: any;

        // Core Branching: Execute answer processing.
        // In AI mode, the lower-level `multiplayer.submitAnswer` (handled by `LocalMultiPlayer`) 
        // intercepts the request right before executing the Lua script, calling `this.aiservice.predictAnswer` 
        // to resolve the AI's response, completing both actions in a single atomic Lua transaction.
        if (gameState.mode === "MULTIPLAYER" || gameState.mode === 'AI') {
            ({ state, lastAnswer } = await this.multiplayer.submitAnswer(gameId, selectedAnswerIndex, userId, expectedQuestionId));
        } else {
            ({ state, lastAnswer } = await this.soloservice.submitAnswer(gameId, selectedAnswerIndex, userId, expectedQuestionId));
        }

        // Idempotency Interception & Protection: If it is a redundant double-click network payload, 
        // return early using the cached state at zero additional execution cost.
        if (lastAnswer?.correctText === 'ALREADY_PROCESSED') {
            return this.mapper.toUpdateResponse(state, lastAnswer);
        }

        // Strategy 3 Complete Decoupling:
        // The asynchronous loop call to `this.aiservice.generateAIAnswer` that previously existed here has been completely removed.
        // Because the AI's resolution is already entirely contained within the returned `state`, 
        // there are no in-memory timers and no race conditions.

        // Hand over the resolved state to the GameMapper for output obfuscation and tailored client data exposure
        const result = this.mapper.toUpdateResponse(state, lastAnswer);
        return result;
    }

    async setReady(roomId: string, userId: string, isReady: boolean): Promise<SetReadyResult> {
        return this.multiplayer.setPlayerReady(roomId, userId, isReady);
    }

    /**
     * Lifecycle termination and resource cleanup.
     */
    async finalize(gameId: string): Promise<void> {
        const state = await this.gameRepository.findById(gameId);
        if (!state || !state.isFinished) return;
        
        const matchResult = this.mapper.toMatchResult(state);
        await this.db.create(matchResult);
        await this.gameRepository.delete(state.gameId);
        
        if (state.mode === 'MULTIPLAYER' || state.mode === 'AI') {
            const roomId = state.roomId;
            const userIds = Object.keys(state.players);
            if (roomId) {
                await this.multiplayer.cleanupRoom(roomId, userIds);
            }
        }
    }

    async getGameState(gameId: string): Promise<GameState | null> {
        return await this.gameRepository.findById(gameId);
    }
}