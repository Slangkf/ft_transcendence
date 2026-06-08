import { GameUpdateResponse, Player, BaseGameState, SoloGameState } from "./game.types";
import { GameBaseService } from "./game.base";
import { RedisGameRepository } from "./game.redis.repository";
import { QuestionService } from "../question/question.service";
import { AppError, ErrorCode } from "../error/apperror";

/**
 * @class SoloService
 * @extends GameBaseService
 * @description Manages the lifecycle and answer processing workflows for pure, single-player game modes.
 * Removes all historical AI companion elements to guarantee synchronous, direct player-driven state updates.
 */
export class SoloService extends GameBaseService{
    protected gamerepository: RedisGameRepository;

    constructor(
        questionservice: QuestionService,
        gamerepository: RedisGameRepository,
    ){
        super(questionservice);
        this.gamerepository = gamerepository;
    }

    /**
     * @method startGame
     * @description Bootstraps a fresh single-player match instance, pulls target question pools, 
     * caches the default single-player map in Redis, and returns the initialized state blueprint.
     * @param {string} userId - Unique tracking id of the active human player.
     * @param {string} nickname - Display name of the active human player.
     * @param {"SOLO"} mode - Strict mode flag defining this execution pathway.
     * @param {string} [category] - Optional database keyword filtering criteria for targeted question sets.
     * @returns {Promise<BaseGameState>} Initial structural state configuration.
     */
    async startGame(userId: string, nickname: string, mode: "SOLO", category?: string): Promise<BaseGameState>{
        // Establish a single-member player map strictly dedicated to the calling user
        const players = {[userId]: this.initPlayers(userId, nickname)};
        
        // Build out base trivia questions, metadata arrays, and timestamps
        const state = await this.prepareGame(players, mode, { category });
        
        // Persist out to high-speed memory for subsequent answer evaluations
        await this.gamerepository.create(state);
       
        return state;
    }

    /**
     * @method submitAnswer
     * @description Ingests, checks, and evaluates the correctness of a user-submitted answer index. 
     * Handles pagination transitions automatically when the solo user completes a question step.
     * @param {string} gameId - Reference key matching the active cache file.
     * @param {number} selectedAnswerIndex - Zero-indexed option provided by the user.
     * @param {string} userId - The string identifier of the answering user.
     * @param {number} [expectedQuestionId] - Race-condition guard parameter validating current out-of-order frames.
     */
    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string, expectedQuestionId?: number): Promise<{
        state: BaseGameState;
        lastAnswer: { playerId: string; isCorrect: boolean; correctAnswerIndex: number; correctText: string };
    }>{
        const state = await this.gamerepository.findById(gameId);
        if (!state) 
            throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
            
        const currentQuestion = state.questions[state.currentQuestionIndex];
        if (!currentQuestion)
            throw new AppError('No more questions', ErrorCode.GAME_ALREADY_FINISHED, 400);
            
        if (state.isFinished) 
            throw new AppError('Game is already finished', ErrorCode.GAME_ALREADY_FINISHED, 400);
            
        // CRITICAL DEBOUNCE GUARD: Protects the single-player workflow if the client double-clicks 
        // or transmits answers twice due to network latency, preventing skipping multiple questions.
        if (expectedQuestionId !== undefined && expectedQuestionId !== currentQuestion.id) {
            return {
                state,
                lastAnswer: {
                    playerId: userId,
                    isCorrect: false,
                    correctAnswerIndex: -1,
                    correctText: 'ALREADY_PROCESSED'
                }
            };
        }
        
        const player = state.players[userId];
        if (!player) 
            throw new AppError('Player not found', ErrorCode.PLAYER_NOT_FOUND, 404);
            
        if (player.status === 'answered') 
            throw new AppError('Player already answered', ErrorCode.PLAYER_ALREADY_ANSWERED, 400);

        // Core score mapping and result data creation from inherited base engine
        const lastAnswer = await this.processAnswer(state, selectedAnswerIndex, userId);
        
        // Evaluates remaining active players. In a pure solo stream, this resolves to true instantly
        const allAnswered = Object.values(state.players)
            .filter((p: Player) => p.status !== 'disconnected')
            .every((p: Player) => p.status === 'answered');

        // Automatically advance indices or wrap up final scores since the player has acted
        if (allAnswered) this.advanceGame(state);
    
        // Sync state back to Redis
        await this.gamerepository.update(state);
        
        return {state, lastAnswer};
    }
}