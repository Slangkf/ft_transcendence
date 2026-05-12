import { AppError, ErrorCode } from "src/error/apperror";
import { IGameRepository } from "src/game/game.redis.repository";
import { QuestionService } from "src/question/question.service";
import { Room } from "src/room/room.types";
import { GameBaseService } from "./game.base";
import { BaseGameState, GameMode, GameUpdateResponse, MultiGameState, Player } from "./game.types";

export class LocalMultiPlayer extends GameBaseService {
    protected gamerepository: IGameRepository;

    constructor(
        questionservice: QuestionService,
        gamerepo: IGameRepository,
    ){
        super(questionservice);
        this.gamerepository = gamerepo;
    }

    async startGame(room: Room): Promise<GameUpdateResponse>{
        const playerlist = Object.values(room.players);
        if (playerlist.length < 2) throw new AppError('Not enough players', ErrorCode.ROOM_PLAYER_NBR, 400);
        
        const players: Record<string, Player> = {};
        
        for(const p of playerlist){
            players[p.userId] = this.initPlayers(p.userId, p.nickname);
        }
        const state = await this.prepareGame(players, GameMode.MULTIPLAYER, {roomId: room.roomId, hostId: room.hostId});

        await this.gamerepository.create(state);
        return {
            ...this.buildResponseForFront(state)
        }
    }

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameUpdateResponse>{
        const state = await this.gamerepository.submitanswerAtomic(
            gameId,
            userId,
            selectedAnswerIndex
        )
    
        if (!state) throw new AppError(
            'Game not found', 
            ErrorCode.GAME_NOT_FOUND,
            404
        )
        
        const currentQuestion = state.questions[state.isFinished ? state.questions.length - 1 : state.currentQuestionIndex - 1];
        const lastAnswerUpdate = {
            playerId: userId,
            questionId: currentQuestion?.id,
            isCorrect: state.players[userId]?.answers.at(-1)?.isCorrect ?? false,
            correctAnswerIndex: currentQuestion?.correctAnswerIndex,
            correctText: currentQuestion?.options[currentQuestion?.correctAnswerIndex],
        };

        return { ...this.buildResponseForFront(state), lastAnswerUpdate };
    }

    override buildResponseForFront(state: BaseGameState): GameUpdateResponse {
        const base = super.buildResponseForFront(state);
        return {
            ...base,
            state: {
                ...base.state,
                player: Object.fromEntries(
                    Object.entries(state.players).map(([id, p]) => [
                        id, 
                        {
                            ...base.state.player[id],
                            nickname: p.nickname,
                        }
                    ])
                )
            }
        }
    }
}
    
