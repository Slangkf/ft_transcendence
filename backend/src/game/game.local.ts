import { fa } from "zod/v4/locales";
import { AppError, ErrorCode } from "../error/apperror";
import { QuestionService } from "../question/question.service";
import { Room } from "../room/room.types";
import { GameBaseService } from "./game.base";
import { RedisGameRepository } from "./game.redis.repository";
import { BaseGameState, MultiGameState, Player } from "./game.types";
import {GameMode} from "@prisma/client"

export class LocalMultiPlayer extends GameBaseService {
    protected gamerepository: RedisGameRepository;

    constructor(
        questionservice: QuestionService,
        gamerepo: RedisGameRepository,
    ){
        super(questionservice);
        this.gamerepository = gamerepo;
    }

    async startGame(room: Room, category?: string): Promise<BaseGameState>{
        const playerlist = Object.values(room.players);
        if (playerlist.length < 2) throw new AppError('Not enough players', ErrorCode.ROOM_PLAYER_NBR, 400);

        const players: Record<string, Player> = {};
        let hasAIInRoom = false;
        for(const p of playerlist){
            const userIdstring = String(p.userId);
            const isAIPlayer = userIdstring.startsWith("ai_");
            if (isAIPlayer){
                hasAIInRoom = true;
            }
            players[p.userId] = {
                ...this.initPlayers(p.userId, p.nickname),
                isAI: isAIPlayer
            }
        }
        let state: MultiGameState
        if (room.AIplayerIds){
             state = await this.prepareGame(players, "AI" as GameMode, {roomId: room.roomId, hostId: room.hostId, category}) as MultiGameState;
        } else{
            state = await this.prepareGame(players, "MULTIPLAYER", {roomId: room.roomId, hostId: room.hostId, category}) as MultiGameState;
        }

        console.log("state in startgame local: ", state);
        if (room.tournamentId) {
            state.tournamentId = room.tournamentId;
        }

        await this.gamerepository.create(state);
        return state;
    }

    // src/game/game.local.ts 中的 submitAnswer 方法

async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string) {
    console.log(`[Lua准备执行] 游戏ID: ${gameId}, 提交者ID: ${userId}, 选择索引: ${selectedAnswerIndex}`);

    // 1. 执行原子化提交
    const gameState = await this.gamerepository.findById(gameId);
    const isAIGame = gameState?.mode === 'AI';

    const rawResult = await this.gamerepository.submitanswerAtomic(
        gameId,
        userId,
        selectedAnswerIndex,
        isAIGame
    );

    // 🌟 核心防御 1：完全打满空值拦截
    if (!rawResult) {
        console.error(`[🚨 Lua执行失败] submitanswerAtomic 返回了空!`);
        throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
    }

    // 🌟 核心防御 2：精准识别 Lua 脚本返回的业务冲突安全锁 (如 ALREADY_ANSWERED)
    if (rawResult.error || (typeof rawResult === 'object' && 'error' in rawResult)) {
        console.warn(`[⚠️ Lua拦截冲突] 玩家 ${userId} 企图重复提交答案或状态对不上。原因: ${rawResult.error}`);
        
        // 既然发生冲突，说明上一次的答题才是有效的。我们直接去 Redis 捞出最新干净的状态返回
        const freshState = await this.gamerepository.findById(gameId);
        if (!freshState) throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);

        // 构建一个安全的、不崩的设计，告诉上层“维持原判”
        return { 
            state: freshState, 
            lastAnswer: {
                playerId: userId,
                isCorrect: freshState.players[userId]?.answers.at(-1)?.isCorrect ?? false,
                correctAnswerIndex: -1,
                correctText: 'ALREADY_PROCESSED'
            } 
        };
    }

    // 2. 只有通过了上面的防御，说明这里的 rawResult 才是完好无损的 BaseGameState 对象
    const state = rawResult as BaseGameState;

    // 🌟 核心防御 3：防止结算索引越界导致 NaN
    const targetIdx = state.isFinished ? state.questions.length - 1 : state.currentQuestionIndex - 1;
    
    // 严谨的安全保护垫：防止开局第 0 题结算时 targetIdx 算出来是 -1 导致 questions[-1] 崩溃
    const safeIdx = targetIdx < 0 ? 0 : targetIdx;
    const currentQuestion = state.questions[safeIdx];

    const submitter = state.players[userId];
    const allAnswered = state.isFinished || submitter?.status === 'playing';

    const lastAnswer = {
        playerId: userId,
        isCorrect: state.players[userId]?.answers.at(-1)?.isCorrect ?? false,
        correctAnswerIndex: currentQuestion?.correctAnswerIndex ?? 0,
        correctText: (allAnswered && currentQuestion) ? currentQuestion.options[currentQuestion.correctAnswerIndex] : 'PENDING',
    };

    return { state, lastAnswer };
}

}
    
