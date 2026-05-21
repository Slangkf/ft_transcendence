import { GameUpdateResponse, Player, BaseGameState, SoloGameState } from "./game.types";
import { GameBaseService } from "./game.base";
import { RedisGameRepository } from "./game.redis.repository";
import { QuestionService } from "../question/question.service";
import { AppError, ErrorCode } from "../error/apperror";
import {GameMode} from "@prisma/client"
import { AIService } from "./ai";


export class SoloService extends GameBaseService{
    protected gamerepository: RedisGameRepository;
    private aiService?: AIService;

    constructor(
        questionservice: QuestionService,
        gamerepository: RedisGameRepository,
        aiService?: AIService
    ){
        super(questionservice);
        this.gamerepository = gamerepository;
        this.aiService = aiService;
    }

    public setAIService(aiService: AIService): void {
        this.aiService = aiService;
    }

    async startGame(userId: string, nickname: string, mode: "SOLO"|"AI", category?: string): Promise<BaseGameState>{
        const players = {[userId]: this.initPlayers(userId, nickname)};
        
        if (mode === "AI") {
            const aiId = "brain";
            players[aiId] = this.initPlayers(aiId, "brain");
            players[aiId].isAI = true;
        }
        
        const state = await this.prepareGame(players, mode, { category });
        await this.gamerepository.create(state);
        
        if (mode === "AI") {
            this.startAIThinking(state);
        }
        
        return state;
    }

    private startAIThinking(state: BaseGameState): void {
        const aiPlayer = Object.values(state.players).find(p => p.isAI);
        if (!aiPlayer) return;
        this.aiService?.generateAIAnswer(state as SoloGameState, aiPlayer.id);
    }

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<{state: BaseGameState;
        lastAnswer: { playerId: string; isCorrect: boolean; correctAnswerIndex: number; correctText: string };
    }>{
        const state = await this.gamerepository.findById(gameId);
        if (!state) throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
        if (state.isFinished) throw new AppError('Game is already finished', ErrorCode.GAME_ALREADY_FINISHED, 400);
        
        const player = state.players[userId];
        if (!player) throw new AppError('Player not found', ErrorCode.PLAYER_NOT_FOUND, 404);
        if (player.status === 'answered') throw new AppError('Player already answered', ErrorCode.PLAYER_ALREADY_ANSWERED, 400);

        const lastAnswer = await this.processAnswer(state, selectedAnswerIndex, userId);
        const allAnswered = Object.values(state.players)
            .filter((p: Player) => !p.isAI || state.mode === GameMode.AI)
            .every((p: Player) => p.status === 'answered');

        if (allAnswered) this.advanceGame(state);
    
        await this.gamerepository.update(state);
        
        if (!state.isFinished && state.mode === GameMode.AI) {
            this.startAIThinking(state);
        }
        
        return {state, lastAnswer};
    }
}