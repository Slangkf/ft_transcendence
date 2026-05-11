import { RoomService } from "src/room/room.service";
import { LocalMultiPlayer } from "./game.local";
import { GameEmitter } from "src/websocket/socket.emitter";
import { MatchService } from "./match/match.service";
import { Session } from "inspector";
import { RoomManager } from "src/room/room.manager";
import { Room } from "src/room/room.types";
import { SessionService } from "./session.service";
import { GameMode, GameUpdateResponse, MatchPlayer, SetReadyResult } from "./game.types";
import { AppError, ErrorCode } from "src/error/apperror";
import { Namespace } from "socket.io";
import { GameService } from "./game.service";
import { Redis, RedisKeys } from "src/lib/redis";


export class MultiPlayerFacade {
    constructor (
        private matchService: MatchService,
        private roomService: RoomService,
        private multiService: LocalMultiPlayer,
        private sessionService: SessionService, 
        private emitter: GameEmitter,
        private gameNs: Namespace,
        private redis: typeof Redis,
    ){}

    async handleAllReady(roomId: string): Promise<SetReadyResult>{
        const room = await this.roomService.getRoom(roomId);
        if (!room || room.status !== "starting") return {allReady: false};

        try{
           const response: GameUpdateResponse = await this.multiService.startGame(room); 

            //session update game status ingame, and gameid 
            await Promise.all(
                Object.values(room.players).map( p=> {
                    this.sessionService.update(p.userId, {
                        status: 'in_game',
                        gameId: response.gameId,
                    })
                })
            )
            if (!response.nextQuestion){
                throw new AppError('No first question available', ErrorCode.BAD_REQUEST);
            }
            
            //notify all players 
            await this.emitter.toRoom(roomId, 'game_started', {
                gameId: response.gameId,
                firstQuestion: response.nextQuestion,
                players: response.state.player,
            })
            return {
                allReady: true,
                gameresponse: response,
            }
        }catch (error){
            console.error("Error starting game:", error);
            await this.roomService.updateStatus(room, 'waiting');
            await this.emitter.toRoom(roomId, 'error', {
                message: "Failed to start game"
            });
            return {allReady: false};
        }
    }

    async joinMatchmaking(mode: GameMode, userId: string, nickname: string): Promise<{status: 'matched'|'waiting'; players?:MatchPlayer[]; roomId?: string}>{
        const exist = await this.matchService.getMyMatch(userId);
        
        if (exist){
            //session service to save the session for player 
            await this.sessionService.update(userId, {
                status: "matched",
                matchId: exist.matchId,
                roomId: exist.roomId,});
            if (!exist.notified) {
                await this.emitter.toUser(userId, 'matched', {
                    roomId: exist.roomId,
                    players: exist.players,
                })
                await this.matchService.updatateMatch({...exist, notified: true});
            }
            return {status: "matched", players: exist.players, roomId: exist.roomId}
        }

        //join queue
        //session update status 
        await this.sessionService.update(userId, {
            status: "queue",
        })

        await this.matchService.joinQueue({
            mode,
            userId,
            nickname
        })
        return await this.trymatch(mode);
    }

    async trymatch(mode: GameMode): Promise<{status: 'matched'|'waiting'; players?:MatchPlayer[]; roomId?: string}>{
        const match = await this.matchService.matchPlayers(mode);

        if (!match) return {status: "waiting"};

        const host = match.players[0];
        const room: Room = await this.roomService.createRoom({
            hostId: host.userId,
            hostNickname: host.nickname,
            players: match.players,
            maxPlayers: match.maxPlayers,
            type: 'game',
        })
        match.roomId = room.roomId;
        //need to update match with roomid  
        await this.matchService.updatateMatch(match);


        //send a message for all user that match successfully
        await Promise.all(
            match.players.map(async player=> {
                //1. join socket in room
                const socketId = await this.redis.get(RedisKeys.socket.gameUser(player.userId));
                if (socketId)
                    this.gameNs.sockets.get(socketId)?.join(room.roomId);
            
            //session and notify
            await Promise.all([
                this.sessionService.update(player.userId, {
                    status: "matched",
                    matchId: match.matchId,
                    roomId: room.roomId
                }),
                this.emitter.toUser(player.userId, 'matched', {
                    roomId: room.roomId,
                    players: match.players,
                }
                )
            ])
        }));

        return {
            status: 'matched',
            players: match.players,
            roomId: room.roomId,
        }
    }

    async setPlayerReady(roomId: string, userId: string, isReady: boolean): Promise<SetReadyResult> {
        const result = await this.roomService.setPlayerReady(roomId, userId, isReady);
        
        //tell every player is ready
        await this.emitter.toRoom(roomId, 'player_ready', {
            playerId: userId,
            isReady,
            allReady: result.allReady,
        })

        const room = result.room;
        if (!result.allReady) return {allReady: false};
        return await this.handleAllReady(roomId);
    }

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameUpdateResponse>{
        return await this.multiService.submitAnswer(gameId, selectedAnswerIndex, userId);
    }

    async handleReconnect(userId: string) {

        const session = await this.sessionService.get(userId);
        if (!session) return;

        if (session.gameId) {
          return { type: "game", gameId: session.gameId };
        }

        if (session.roomId) {
          return { type: "room", roomId: session.roomId };
        }

        if (session.matchId) {
          return { type: "match", matchId: session.matchId };
        }

        return { type: "queue" };
    }   
}   