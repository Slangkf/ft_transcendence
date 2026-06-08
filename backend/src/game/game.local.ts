import { AppError, ErrorCode } from "../error/apperror";
import { QuestionService } from "../question/question.service";
import { Room } from "../room/room.types";
import { GameBaseService } from "./game.base";
import { RedisGameRepository } from "./game.redis.repository";
import { AtomicAnswerTask, BaseGameState, LastAnswerUpdate, MultiGameState, Player } from "./game.types";
import { GameMode } from "@prisma/client";
import { AIService } from "./ai";

/**
 * LocalMultiPlayer
 * Responsible for the initialization transition from local lobby rooms to the game state machine,
 * and driving the Redis Lua sandbox to complete atomic answer settlements for multiplayer matches.
 * * Follows Strategy 3: Real-time AI resolution at the moment a human player submits their answer,
 * eliminating any asynchronous Timer race conditions.
 */
export class LocalMultiPlayer extends GameBaseService {
    constructor(
        questionservice: QuestionService,
        protected readonly gamerepository: RedisGameRepository,
        private readonly aiservice: AIService,
    ){
        super(questionservice);
    }

    /**
     * Converts a successfully matched Lobby Room into a distributed, in-memory runtime Live GameState snapshot.
     * * @param room The current matchmaking lobby room object.
     * @param category Optional quiz category filter.
     * @returns A Promise that resolves to the initialized BaseGameState.
     * @throws AppError if there are fewer than 2 players in the room.
     */
    async startGame(room: Room, category?: string): Promise<BaseGameState> {
        const playerlist = Object.values(room.players);

        // Core defense: Online matches must satisfy at least 2 active connections
        if (playerlist.length < 2) {
            throw new AppError('Not enough players', ErrorCode.ROOM_PLAYER_NBR, 400);
        }

        const players: Record<string, Player> = {};
        let hasAIInRoom = false;

        // Unpack room players and build player profiles including virtual AI flags
        for (const p of playerlist) {
            const userIdstring = String(p.userId);
            const isAIPlayer = userIdstring.startsWith("ai_");
            if (isAIPlayer) {
                hasAIInRoom = true;
            }
            
            players[userIdstring] = {
                ...this.initPlayers(userIdstring, p.nickname),
                isAI: isAIPlayer
            };
        }

        let state: MultiGameState;

        // Branching analysis: Determine whether to generate an AI match room or a pure human multiplayer room based on attributes
        if (hasAIInRoom) {
            state = await this.prepareGame(players, "AI" as GameMode, { roomId: room.roomId, hostId: room.hostId, category }) as MultiGameState;
        } else {
            state = await this.prepareGame(players, "MULTIPLAYER", { roomId: room.roomId, hostId: room.hostId, category }) as MultiGameState;
        }

        console.log("[Game Init Local] Successfully initialized state for room, mode: ", state.mode);
        console.log("roomId: ", state.roomId);

        // Tournament room context penetration
        if (room.tournamentId) {
            state.tournamentId = room.tournamentId;
        }

        // Serialize perfectly and store into the Redis memory area
        await this.gamerepository.create(state);
        return state;
    }

    /**
     * The unique entry pipeline for answer submissions.
     * Strategy 3 Core Evolution: Pre-evaluate and synchronously load the AI's decision payload before executing the Lua script.
     * * @param gameId The unique identifier of the active game.
     * @param selectedAnswerIndex The option index selected by the submitting user.
     * @param userId The unique identifier of the submitting user.
     * @returns An object containing the updated game state and metadata regarding the last answer update.
     * @throws AppError if the game state or current question cannot be found.
     */
    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string, expectedQuestionId?: number): Promise<{
        state: BaseGameState;
        lastAnswer: LastAnswerUpdate;
    }> {
        console.log(`[submit] game=${gameId}, user=${userId}, answer=${selectedAnswerIndex}`);

        // 1. Extract the current frontline snapshot to evaluate if the AI needs to make a pre-calculation silently
        const currentGameState = await this.gamerepository.findById(gameId);
        if (!currentGameState) {
            throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
        }
        const playerId = String(userId);
        const currentQuestion = currentGameState.questions[currentGameState.currentQuestionIndex];
        if (!currentQuestion) {
            throw new AppError('Question not found', ErrorCode.QUESTION_NOT_FOUND, 404);
        }
        if (expectedQuestionId !== undefined && expectedQuestionId !== currentQuestion.id) {
            return {
                state: currentGameState,
                lastAnswer: {
                    playerId,
                    isCorrect: false,
                    correctAnswerIndex: -1,
                    correctText: 'ALREADY_PROCESSED'
                }
            };
        }

        const tasks: AtomicAnswerTask[] = [{
            id: playerId,
            ans: selectedAnswerIndex,
            questionId: currentQuestion.id,
        }];
        const isAIGame = currentGameState.mode === 'AI';

        // If the current mode is AI and the game is not yet finished
        if (isAIGame && !currentGameState.isFinished) {
            const aiId = Object.keys(currentGameState.players).find(id => currentGameState.players[id].isAI);
            const aiPlayer = aiId ? currentGameState.players[aiId] : null;

            // The AIService strategist will only step in if the AI is still in a 'playing' state for the current question
            if (aiId && aiPlayer && aiPlayer.status === 'playing') {
                // Invoke the pure synchronous prediction function to calculate the AI answer and hidden unlock timestamp
                const aiPayload = this.aiservice.predictAnswer(currentGameState, aiId);
                if (aiPayload.questionId === currentQuestion.id) {
                    tasks.push({
                        id: aiPayload.aiId,
                        ans: aiPayload.selectedAnswerIndex,
                        questionId: aiPayload.questionId,
                        visibleAt: aiPayload.visibleAt,
                    });
                }
            }
        }

        // 2. Critical Fix: Package both the human player's answer and the AI's predicted answer into unified atomic tasks for the Lua script
        const result = await this.gamerepository.submitanswerAtomic(
            gameId,
            tasks,
            Date.now()
        );

        // 3. Basic null value and state-not-found boundary defense
        if (!result || result.error === "STATE_NOT_FOUND") {
            throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
        }

        // 4. Precisely identify conflict states returned by Lua, serving as internal traffic lights for the upper GameService layer
        if (result.error === "ALREADY_ANSWERED") {
            // Idempotency interception: Indicates the user triggered multiple clicks. The duplicated signal allows the upper layer to short-circuit without repeating external side-effects.
            return {
                state: result.state,
                lastAnswer: {
                    playerId,
                    isCorrect: false,
                    correctAnswerIndex: currentQuestion.correctAnswerIndex,
                    correctText: 'ALREADY_PROCESSED'
                }
            };
        }
        if (result.error === "GAME_FINISHED" || result.error === "NO_QUESTION") {
            // Expiration interceptor: Indicates the submission happened right during a question transition boundary. Safely ignore redundant logic.
            return {
                state: result.state,
                lastAnswer: {
                    playerId,
                    isCorrect: false,
                    correctAnswerIndex: currentQuestion.correctAnswerIndex,
                    correctText: 'ALREADY_PROCESSED'
                }
            };
        }

        // 5. Assemble metadata to return to the single-entry coordinator (GameService)
        const state = result.state as BaseGameState;
        const roundResolved = state.isFinished
            || state.currentQuestionIndex !== currentGameState.currentQuestionIndex
            || Object.values(state.players)
                .filter(player => player.status !== 'disconnected')
                .every(player => player.status === 'answered');
        const correctText = currentQuestion.options[currentQuestion.correctAnswerIndex] ?? "";
        const lastAnswer = {
            playerId,
            isCorrect: selectedAnswerIndex === currentQuestion.correctAnswerIndex,
            correctAnswerIndex: roundResolved ? currentQuestion.correctAnswerIndex : -1,
            correctText: roundResolved ? correctText : "",
        };

        return { state, lastAnswer };
    }
}