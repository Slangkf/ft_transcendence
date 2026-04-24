import { GameBaseService } from "../game.base";
import {  GameInfo, StartGameResult } from "../game.types";
import { AppError, ErrorCode } from "src/error/apperror";
import { Room, RoomPlayer } from "src/room/room.types";

export class MultiService extends GameBaseService {
    async startGame(room: Room): Promise<StartGameResult>{
        
        const playerlist = Object.values(room.players);
        const players = this.buildPlayerFromRoom(playerlist);

        const state = await this.prepareGame(
            players,
            "multiplayer",
            {roomId: room.roomId, hostId: room.hostId}
        )
        await this.gameRepository.create(state);
        return {
            gameId: state.gameId,
            question: this.questionService.toPublicQuestion(state.questions[0]),
        }
    }
    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameInfo | null> {
        const state = await this.gameRepository.findById(gameId);
        if (!state) throw new AppError('Game not found', ErrorCode.GAME_NOT_FOUND, 404);
        if (state.isFinished) throw new AppError('Game is finished', ErrorCode.GAME_FINISHED, 409);
   
        const player= state.players[userId];
        if (!player) throw new AppError('Player not found', ErrorCode.PLAYER_NOT_FOUND, 404);
        if (player.status === 'answered') throw new AppError('Player already answered', ErrorCode.PLAYER_ALREADY_ANSWERED, 409);

        this.validateAnswer(state, selectedAnswerIndex, userId);
        const allAnswered = Object.values(state.players).every(p => p.status === 'answered')
        if (allAnswered){
            this.advance(state);
        }

        await this.gameRepository.update(state);
        if (state.isFinished){
            await this.gameRepository.delete(state.gameId);
            return this.buildfinishedGameInfo(state);
        }

        return this.buildPlayingGameInfo(state);
    }
    
    private buildPlayerFromRoom(roomplayers: RoomPlayer[]){
        return Object.fromEntries(
            roomplayers.map((rp, index)=> 
                [rp.id, this.buildPlayer(rp.id, {joinOrder: index})])
        )
    }
}