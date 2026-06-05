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
 * GameService (Core Orchestrator - 方案 3 统一架构版)
 * 作为整个游戏的单入口协调者。由于引入了方案 3，本服务不再承接任何 AI 的异步定时器调度。
 * AI 的答案在玩家点击提交时，已经通过下层 LocalMultiPlayer 和 Lua 顺便在同毫秒内秒杀完成了。
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
     * 开启游戏 match 入口
     */
    async startGame(params: StartGameParams): Promise<GameStartResult> {
        const { mode, userId, nickname, category, size } = params;

        switch (mode) {
            case "SOLO": {
                const state = await this.soloservice.startGame(userId, nickname, mode, category);
                return this.mapper.toUpdateResponse(state);
            }
            case "AI": {
                // 🌟 【方案 3 的优雅变革】：
                // 在 createAIGame 时，LocalMultiPlayer 内部的初始化会将开局第 0 题的 AI 初始快照准备好并存入 Redis。
                // 我们不再需要在这里调用异步的 generateAIAnswer。AI 开局即静静等待玩家点击首发题。
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
     * 玩家（人类）答题的核心入口管道
     */
    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameUpdateResponse> {
        const gameState = await this.gameRepository.findById(gameId);
        if (!gameState) {
            throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
        }

        let state: BaseGameState;
        let lastAnswer: any;

        // 🌟 核心分流：执行答题。
        // 在 AI 模式下，下层的 multiplayer.submitAnswer (即 LocalMultiPlayer)
        // 会在击打 Lua 前现场调用 `this.aiservice.predictAnswer` 计算 AI 方案，并在一发 Lua 中同时完结。
        if (gameState.mode === "MULTIPLAYER" || gameState.mode === 'AI') {
            ({ state, lastAnswer } = await this.multiplayer.submitAnswer(gameId, selectedAnswerIndex, userId));
        } else {
            ({ state, lastAnswer } = await this.soloservice.submitAnswer(gameId, selectedAnswerIndex, userId));
        }

        // 幂等性拦截防护：如果是无意义的重复连击网络包，直接利用零开销的缓存状态退回
        if (lastAnswer?.correctText === 'ALREADY_PROCESSED') {
            return this.mapper.toUpdateResponse(state, lastAnswer);
        }

        // 🌟 【方案 3 彻底解耦】：
        // 删掉了原本在这里对 `this.aiservice.generateAIAnswer` 的异步循环调用！
        // 因为 AI 的结果已经 100% 躺在上面的 `state` 里面了，没有内存定时器，没有竞态条件。

        // 🌟 移交给具有视觉脱敏伪装魔术的 GameMapper 进行输出裁剪
        const result = this.mapper.toUpdateResponse(state, lastAnswer);
        return result;
    }

    async setReady(roomId: string, userId: string, isReady: boolean): Promise<SetReadyResult> {
        return this.multiplayer.setPlayerReady(roomId, userId, isReady);
    }

    /**
     * 生命周期终结清理
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
