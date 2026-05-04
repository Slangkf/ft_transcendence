import { MultiService } from "./multi";
import  type {
    StartGameResult,
    GameInfo,
    StartGameParms,
    StartMultiResult,
    GameState
}from "../game.types"; 
import { AppError, ErrorCode } from "src/error/apperror";
import { Room, RoomPlayer } from "src/room/room.types";
import { RoomManager } from "src/room/room.manager";
import { MatchService } from "src/game/multiplayer/match/match.service";
import {randomUUID} from 'crypto';
import { IEmitter } from "src/websocket/socket.emitter";


export class Multiplayer {
    constructor(
        private matchservice: MatchService,
        private roommanager: RoomManager,
        private multiservice: MultiService,
        private emitter: IEmitter,
    ){}

    //start multi begin with waiting match in match service
    //then the user set ready, the status of player change and check if all players are ready in a room
    //then start the game 

    async joinMatchmaking(params: StartGameParms): Promise<StartMultiResult>{
        const exist = await this.matchservice.getMyMatch(params.userId);

        if (exist){
            return {
                status: "matched",
                roomId: exist.roomId,
                players: exist.players,
            }
        }
        await this.matchservice.joinQueue({
            mode: params.mode,
            userId: params.userId,
            nickname: params.nickname
        })
        
        return await this.tryMatch(params.mode);
    }

    async tryMatch(mode: string): Promise<StartMultiResult>{
        const roomId = randomUUID();
        const match = await this.matchservice.matchPlayers(mode, roomId);

        if (!match){
            return {status: "waiting"}
        }

        const host = match.players[0];
        const room = await this.roommanager.createRoom({
            hostId: host.userId,
            hostNickname: host.nickname,
            players: match.players,
            maxPlayers: match.maxPlayers,
            type: 'game'
        })


        //send a message for all user that match successfully
        for(const player of match.players){
            await this.emitter.toUser(player.userId, 'matched', {
                roomId: room.roomId,
                players: match.players,
            })
        }

        return {
            status: 'matched',
            players: match.players,
            roomId: room.roomId,
        }
    }

    // Player sets ready in the room
    // Returns game start result if all players are ready, otherwise null
    async setPlayerReady(roomId: string, userId: string, isReady: boolean): Promise<StartGameResult | null> {
        const result = await this.roommanager.setReady(roomId, userId, isReady);
        
        //tell every player is ready
        await this.emitter.toRoom(roomId, 'player_ready', {
            playerId: userId,
            isReady,
            allReady: result.allReady,
        })


        // If all players are ready, start the game
        if (result.allReady) {
            return this.startGameFromRoom(result.room);
        }
        
        return null;
    }
    
    //when all players are ready,start 
    async startGameFromRoom(room: Room): Promise<StartGameResult>{
        const result = await this.multiservice.startGame(room);

        room.sessionId = result.gameId;

        await this.roommanager.updateStatus(room, "active");

        await this.emitter.toRoom(room.roomId, 'game_started', result); 

        return result;
    }

    

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameInfo | null> {
        const result = await this.multiservice.submitAnswer(gameId, selectedAnswerIndex, userId);
        if (!result)
            return null;

        const gamestate = await this.multiservice.getGameState(gameId);
        if (gamestate && 'roomId' in gamestate){
            await this.emitter.toRoom(gamestate.roomId, 'answer_result', result);
        }
        return result;
    }

    
}
/****
 * the layer to make multiplayer and room together(?? multiplayer entry by here or game? )
 * need to add websocket service with it 
 */