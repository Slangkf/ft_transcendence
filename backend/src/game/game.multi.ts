import { LocalMultiPlayer } from "./game.local";
import { MatchService } from "./match/match.service";
import { Session } from "inspector";
import { SessionService } from "./session.service";
import { BaseGameState,  GameState, GameUpdateResponse, MatchPlayer, SetReadyResult } from "./game.types";
import { Namespace } from "socket.io";
import { GameService } from "./game.service";
import { RoomService } from "../room/room.service";
import { GameEmitter } from "../websocket/socket.emitter";
import { Redis, RedisKeys } from "../lib/redis";
import { AppError, ErrorCode } from "../error/apperror";
import { Room } from "../room/room.types";
import { TournamentService } from "../tournament/tournament.service";
import { GameMapper } from "./game.mapper";
import {GameMode} from "@prisma/client"


export class MultiPlayerFacade {
    private tournamentService?: TournamentService;
    constructor (
        private matchService: MatchService,
        private roomService: RoomService,
        private multiService: LocalMultiPlayer,
        private sessionService: SessionService,
        private emitter: GameEmitter,
        private gameNs: Namespace,
        private redis: typeof Redis,
        private mapper: GameMapper,
    ){}

    setTournamentService(ts: TournamentService) {
        this.tournamentService = ts;
    }

    async handleAllReady(roomId: string): Promise<SetReadyResult>{
        const room = await this.roomService.getRoom(roomId);
        if (!room || room.status !== "starting") return {allReady: false};

        // short-lived lock so two concurrent "all ready" triggers can't both start the game
        const lockKey = `lock:game-start:${roomId}`;
        const acquired = await this.redis.set(lockKey, '1', { NX: true, EX: 10 });
        if (!acquired) return {allReady: false};

        try{
            const state = await this.multiService.startGame(room);
            const response = this.mapper.toUpdateResponse(state);

            if (!response.nextQuestion){
                throw new AppError('No first question available', ErrorCode.BAD_REQUEST);
            }

            // mark the room as running so any further setReady calls bail out
            await this.roomService.updateStatus(room, 'active');

            //session update game status ingame, and gameid
            await Promise.all(
                Object.values(room.players).map( p=> {
                    this.sessionService.update(p.userId, {
                        status: 'in_game',
                        gameId: response.gameId,
                        tournamentId: room.tournamentId,
                    })
                })
            )

            // if this room is part of a tournament, link the new gameId to its bracket match
            if (room.tournamentId && this.tournamentService) {
                await this.tournamentService.linkGameToMatch(room.tournamentId, room.roomId, response.gameId);
            }

            //notify all players
            await this.emitter.toRoom(roomId, 'game_started', {
                gameId: response.gameId,
                firstQuestion: response.nextQuestion,
                players: response.state.player,
                startedAt: response.state.startedAt ?? Date.now(),
            })
            return {
                allReady: true,
                gameresponse: response,
            }
        }catch (error){
            console.error("Error starting game:", error);
            // roll back so players can retry: clear ready flags and reopen the room
            Object.values(room.players).forEach(p => { p.isReady = false; });
            room.status = 'waiting';
            await this.roomService.save(room);
            await this.redis.del(lockKey);
            await this.emitter.toRoom(roomId, 'error', {
                message: "Failed to start game"
            });
            return {allReady: false};
        }
    }

    async joinMatchmaking(mode: GameMode, userId: string, nickname: string, size?: number): Promise<{status: 'matched'|'waiting'; players?:MatchPlayer[]; roomId?: string}>{
        if (size !== undefined && (!Number.isInteger(size) || size < 2 || size > 4)) {
            throw new AppError('Invalid player size, must be between 2 and 4', ErrorCode.GAME_UNKOWN_MODE, 400);
        }
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
            nickname,
            size: size ?? 2,
        })
        return await this.trymatch(mode, size ?? 2);
    }

    async trymatch(mode: GameMode, size?: number): Promise<{status: 'matched'|'waiting'; players?:MatchPlayer[]; roomId?: string}>{
        const match = await this.matchService.matchPlayers(mode, size);

        if (!match) return {status: "waiting"};

        const host = match.players[0];
        const room: Room = await this.roomService.createRoom({
            hostId: host.userId,
            hostNickname: host.nickname,
            players: match.players,
            maxPlayers: match.maxPlayers,
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

        //tell every player is ready (only when the state actually changed, to avoid bouncing)
        if (result.changed){
            await this.emitter.toRoom(roomId, 'player_ready', {
                playerId: userId,
                isReady,
                allReady: result.allReady,
            })
        }

        if (!result.allReady) return {allReady: false};
        return await this.handleAllReady(roomId);
    }

    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<{state: BaseGameState, 
            lastAnswer: { playerId: string; isCorrect: boolean; correctAnswerIndex: number; correctText: string };}> {
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

/***
 *  facade combine all for multiplayer game 
 * 
 * 
 */