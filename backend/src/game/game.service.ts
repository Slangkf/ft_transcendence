import { AppError, ErrorCode } from "../error/apperror";
import { QuestionService } from "../question/question.service";
import { AIService } from "./ai";
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
        private mapper: GameMapper, // prepare the response for front and in database 
        private aiservice: AIService
    ){}

    async listCategories(): Promise<string[]> {
        return this.questionService.getCategories();
    }

    async startGame(params:StartGameParams): Promise<GameUpdateResponse | { status: 'matched' | 'waiting'; roomId?: string; players?: MatchPlayer[] }>{
        const {mode, userId, nickname, category, size} = params;

        switch(mode){
            case "SOLO":{
                const state = await this.soloservice.startGame(userId, nickname, mode, category);
                return this.mapper.toUpdateResponse(state);
            }
            case "AI":{
                const state = await this.multiplayer.createAIGame(userId, nickname, category);
                const aiId = Object.keys(state.players).find(id => state.players[id].isAI);
                if (aiId){
                    console.log("[ai reply in startgame]")
                    console.log("gameid: ", state.gameId);
                    console.log("aiid: ", aiId);
                    console.log("players: ", Object.keys(state.players))
                    console.log("question index: ", state.currentQuestionIndex);
                    this.aiservice.generateAIAnswer(state, aiId);
                }
                return this.mapper.toUpdateResponse(state);
            }
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

    // src/game/game.service.ts 中的 submitAnswer 方法

async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameUpdateResponse>{
    const gameState = await this.gameRepository.findById(gameId);
    if (!gameState) {
        throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
    }

    // 🌟 1. 牢牢记住在执行 Lua 脚本提交前的老题号（比如第 0 题）
    const oldQuestionIndex = gameState.currentQuestionIndex;

    let state: BaseGameState;
    let lastAnswer: any;

    if (gameState.mode === "MULTIPLAYER" || gameState.mode === 'AI') {
        ({state, lastAnswer} = await this.multiplayer.submitAnswer(gameId, selectedAnswerIndex, userId));
    } else {
        ({state, lastAnswer} = await this.soloservice.submitAnswer(gameId, selectedAnswerIndex, userId));
    }

    // 🌟 2. 如果是无意义的、被 Lua 拦截的旧网络包，直接退回，不做任何动作
    if (lastAnswer?.correctText === 'ALREADY_PROCESSED') {
        return this.mapper.toUpdateResponse(state, lastAnswer);
    }

    // 🌟 3. 终极 AI 唤醒锁
    if (gameState.mode === "AI" && !state.isFinished) {
        const aiId = Object.keys(state.players).find(id => state.players[id].isAI);
        
        if (aiId) {
            // 🌟 核心破局点：比对 Lua 执行完之后的最新题号
            const newQuestionIndex = state.currentQuestionIndex;

            // 🚨 黄金准则：只要题号变大了，说明全场都答完了上一题，现在【新的一题刚刚开始】！
            // 此时不管刚才最后交卷推进游戏的是人类还是 AI，都必须立刻叫醒 AI 开始新一轮思考！
            if (newQuestionIndex > oldQuestionIndex) {
                console.log(`[🤖 AI调度] 检测到题号由第 ${oldQuestionIndex} 题推进到第 ${newQuestionIndex} 题，无条件唤醒 AI 新一轮作答。`);
                this.aiservice.generateAIAnswer(state, aiId);
            }
        }
    }

    const result = this.mapper.toUpdateResponse(state, lastAnswer);
    console.log(result);
    return result;
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
        if (state.mode === 'MULTIPLAYER' || state.mode === 'AI'){
            const roomId = state.roomId;
            const userIds = Object.keys(state.players);
            if (roomId){
                await this.multiplayer.cleanupRoom(roomId, userIds);
            }
        }
    }

    async getGameState(gameId: string): Promise<GameState | null>{
        return await this.gameRepository.findById(gameId);
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