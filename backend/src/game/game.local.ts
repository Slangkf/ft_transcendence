import { AppError, ErrorCode } from "../error/apperror";
import { QuestionService } from "../question/question.service";
import { Room } from "../room/room.types";
import { GameBaseService } from "./game.base";
import { RedisGameRepository } from "./game.redis.repository";
import { BaseGameState, GameUpdateResponse, MultiGameState, Player } from "./game.types";
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
        
        for(const p of playerlist){
            players[p.userId] = this.initPlayers(p.userId, p.nickname);
        }
        const state = await this.prepareGame(players, "MULTIPLAYER", {roomId: room.roomId, hostId: room.hostId, category});

        await this.gamerepository.create(state);
        return state;
    }

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<{state: BaseGameState, 
        lastAnswer:{playerId: string; isCorrect: boolean; correctAnswerIndex: number; correctText: string }
    }>{
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
        const submitter = state.players[userId] as Player | undefined;
        const allAnswered = state.isFinished || submitter?.status === 'playing';

        const lastAnswer = {
            playerId: userId,
            isCorrect: state.players[userId]?.answers.at(-1)?.isCorrect ?? false,
            correctAnswerIndex: currentQuestion?.correctAnswerIndex,
            correctText: allAnswered ? currentQuestion?.options[currentQuestion?.correctAnswerIndex] : undefined,
        };

        return { state, lastAnswer };
    }

}
    
