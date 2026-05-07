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
//import { RoomManager } from "src/room/room.manager";
import { MatchService } from "src/game/multiplayer/match/match.service";
import {randomUUID} from 'crypto';
import { GameEmitter } from "src/websocket/socket.emitter";
import { RoomService } from "src/room/room.service";


export class Multiplayer {
    constructor(
        private matchservice: MatchService,
        private roomservice: RoomService,
        private multiservice: MultiService,
        private emitter: GameEmitter,
    ){}

    //start multi begin with waiting match in match service
    //then the user set ready, the status of player change and check if all players are ready in a room
    //then start the game 

    async joinMatchmaking(params: StartGameParms): Promise<StartMultiResult>{
        const exist = await this.matchservice.getMyMatch(params.userId);

        if (exist){
            return {
                status: "matched",
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
        const match = await this.matchservice.matchPlayers(mode);

        if (!match){
            return {status: "waiting"}
        }

        const host = match.players[0];
        const room: Room = await this.roomservice.createRoom({
            hostId: host.userId,
            hostNickname: host.nickname,
            players: match.players,
            maxPlayers: match.maxPlayers,
            type: 'game',
        })
        match.roomId = room.roomId;
        //need to update match with roomid  
        await this.matchservice.updatateMatch(match);

        //send a message for all user that match successfully
        for(const player of match.players){
            //await this.emitter.joinRoom(player.userId, room.roomId);
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
        const result = await this.roomservice.setPlayerReady(roomId, userId, isReady);
        
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

        await this.roomservice.updateStatus(room, "active");

        await this.emitter.toRoom(room.roomId, 'game_started', result); 

        return result;
    }

    

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameInfo | null> {
        // 先从match或room获取roomId和matchId
        const match = await this.matchservice.getMyMatch(userId);
        let roomId: string | null = null;
        let matchId: string | null = null;
        let playerIds: string[] = [];
        
        if (match && match.roomId) {
            roomId = match.roomId;
            matchId = match.matchId;
            playerIds = match.players.map(p => p.userId);
        } else {
            // 如果match不存在，直接从room查询
            const room = await this.roomservice.getRoomByPlayerId(userId);
            if (room) {
                roomId = room.roomId;
                playerIds = Object.keys(room.players);
            }
        }

        const result = await this.multiservice.submitAnswer(gameId, selectedAnswerIndex, userId);
        if (!result)
            return null;

        // 发送answer_result到room
        if (roomId) {
            await this.emitter.toRoom(roomId, 'answer_result', result);

            // 游戏完成时清理room和match
            if (result && 'finalscore' in result) {
                const room = await this.roomservice.getRoom(roomId);
                if (room) {
                    await this.roomservice.updateStatus(room, "closed");
                    
                    // 清理match记录
                    if (matchId && playerIds.length > 0) {
                        // 不能直接访问matchrepository，需要通过service
                        // 先清理每个玩家的queue/match关系
                        for (const playerId of playerIds) {
                            await this.matchservice.leaveQueue(playerId);
                        }
                    }
                }
            }
        }

        return result;
    }

    
}
/****
 * the layer to make multiplayer and room together(?? multiplayer entry by here or game? )
 * need to add websocket service with it 
 */