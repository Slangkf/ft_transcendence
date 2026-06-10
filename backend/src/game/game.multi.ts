import { LocalMultiPlayer } from "./game.local";
import { MatchService } from "./match/match.service";
import { Session } from "inspector";
import { SessionService } from "./session.service";
import { BaseGameState,  GameState, GameUpdateResponse, MatchPlayer, MultiGameState, Player, SetReadyResult } from "./game.types";
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
import { QuestionTimerService } from "./question-timer.service";
import { ReadyTimerService } from "./ready-timer.service";


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
        private questionTimer: QuestionTimerService,
        private readyTimer: ReadyTimerService,
    ){}

    /* Injects the TournamentService late, breaking the circular dependency between the two. */
    setTournamentService(ts: TournamentService) {
        this.tournamentService = ts;
    }

    /**
     * @method handleAllReay
     * @description start game when all players are ready 
     * - verify room state
     * - acquire startup lock
     * - cancel readiness timer
     * - create game state
     * - update room status, update player sessions
     * - link tournament match if needed
     * - notify all players
     * - start question timer
     * @param roomId 
     * @returns 
     */
    async handleAllReady(roomId: string): Promise<SetReadyResult>{
        const room = await this.roomService.getRoom(roomId);
        if (!room || room.status !== "starting")
            return {allReady: false};

        // short-lived lock so two concurrent "all ready" triggers can't both start the game
        const lockKey = `lock:game-start:${roomId}`;
        const acquired = await this.redis.set(lockKey, '1', { NX: true, EX: 10 });
        if (!acquired) return {allReady: false};

        // everyone is ready — the readiness deadline no longer applies
        this.readyTimer.cancel(roomId);

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
                Object.values(room.players).map(p =>
                    this.sessionService.update(p.userId, {
                        status: 'in_game',
                        gameId: response.gameId,
                        tournamentId: room.tournamentId,
                    })
                )
            )

            // if this room is part of a tournament, link the new gameId to its bracket match
            if (room.tournamentId && this.tournamentService) {
                await this.tournamentService.linkGameToMatch(room.tournamentId, room.roomId, response.gameId);
            }

            // KEY DIAGNOSTIC: how many sockets are actually in this room right now?
            // game_started is a room broadcast (toRoom). If membersInRoom < the
            // number of players, the missing player(s) NEVER receive game_started
            // and stay stuck on the "Ready" screen → bounced to the bracket when
            // the match resolves without them. This is the remote-only symptom.
            const roomMembers = this.gameNs.adapter.rooms.get(roomId);
            const memberIds = roomMembers ? Array.from(roomMembers) : [];

            if (memberIds.length < Object.keys(room.players).length) {
                console.warn(`[TOURNEY] !!! room=${roomId} has FEWER sockets than players — someone will MISS game_started and be bounced to the bracket`);
            }

            //notify all players
            await this.emitter.toRoom(roomId, 'game_started', {
                gameId: response.gameId,
                firstQuestion: response.nextQuestion,
                players: response.state.player,
                startedAt: response.state.startedAt ?? Date.now(),
                totalQuestions: response.state.totalQuestions,
            })
            // arm the per-question deadline for the first question
            await this.questionTimer.schedule(response.gameId);
            return {
                allReady: true,
                gameresponse: response,
            }
        }catch (error){
            console.error(`[TOURNEY] Error starting game room=${roomId}:`, error);
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

    /**
     * @method joinMatchmaking
     * @description add a player to the matchmaking system 
     * possible: matched immediately, added to queue, reconnected to an existing match
     * 
     * @param mode 
     * @param userId 
     * @param nickname 
     * @param size 
     * @returns 
     */
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

    /**
     * @method trymatch
     * @description attempt to create a match from queued players
     * if enough players are available: 
     *  create room, asign sockets, update sessions, notify participants, start ready countdown 
     * @param mode 
     * @param size 
     * @returns 
     */
    async trymatch(mode: GameMode, size?: number): Promise<{status: 'matched'|'waiting'; players?:MatchPlayer[]; roomId?: string}>{
        // Serialize matchmaking: two players hitting /start at the same instant must
        // not both read the same queue and spawn two rooms for the same pair. (The
        // tournament path already guards this via lock:tournament-start.) If the lock
        // is held, another matcher is running and we're already enqueued — it will
        // match us and emit 'matched' over the socket, so we just report waiting.
        const lockKey = `lock:mp-match:${mode}`;
        let acquired: string | null = null;
        for (let i = 0; i < 5 && !acquired; i++) {
            acquired = await this.redis.set(lockKey, '1', { NX: true, EX: 5 });
            if (!acquired) await new Promise(r => setTimeout(r, 80));
        }
        if (!acquired) return {status: "waiting"};

        try {
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

        await this.matchService.deleteMatch(match.matchId);

        // start the readiness countdown: if not everyone clicks "Ready" in time,
        // the lobby is resolved (see handleReadyTimeout)
        this.readyTimer.arm(room.roomId);

        return {
            status: 'matched',
            players: match.players,
            roomId: room.roomId,
        }
        } finally {
            await this.redis.del(lockKey);
        }
    }

    /**
     * Readiness deadline expired for a room: not everyone clicked "Ready".
     * Tournament rooms forfeit the idle player(s); plain multiplayer rooms
     * abort and send everyone back to the menu.
     */
    async handleReadyTimeout(roomId: string): Promise<void> {
        const room = await this.roomService.getRoom(roomId);
        // if the game already started (status !== 'waiting') or the room is gone, nothing to do
        if (!room || room.status !== 'waiting')
            return;

        const players = Object.values(room.players);
        const notReady = players.filter(p => !p.isReady);

        if (notReady.length === 0) return; // race: everyone readied just in time

        if (room.tournamentId && this.tournamentService) {
            await this.tournamentService.handleReadyTimeout(
                room.tournamentId,
                roomId,
                notReady.map(p => p.userId),
            );
            return;
        }

        // plain multiplayer: the match can't proceed — disband it. Idle players are
        // "excluded"; players who were ready are bounced back to re-queue.
        await Promise.all(players.map(async p => {
            await this.emitter.toUser(p.userId, 'ready_timeout', {
                roomId,
                excluded: !p.isReady,
            });
            await this.sessionService.update(p.userId, {
                status: 'idle',
                roomId: undefined,
                gameId: undefined,
                matchId: undefined,
            });
            const socketId = await this.redis.get(RedisKeys.socket.gameUser(p.userId));
            if (socketId) this.gameNs.sockets.get(socketId)?.leave(roomId);
        }));
        await this.roomService.deleteRoom(roomId);
    }

    /*
     * Flips a player's ready flag, broadcasts player_ready when it changed,
     * and starts the game (handleAllReady) once everyone is ready.
     */
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

    /* Delegates an answer submission to the underlying LocalMultiPlayer engine. */
    async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string, expectedQuestionId?: number): Promise<{state: BaseGameState,
            lastAnswer: { playerId: string; isCorrect: boolean; correctAnswerIndex: number; correctText: string };}> {
        return await this.multiService.submitAnswer(gameId, selectedAnswerIndex, userId, expectedQuestionId);
    }

    /*
     * Resolves where a reconnecting user belongs from their session:
     * an active game, room, or match — defaulting to the matchmaking queue.
     */
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

    /**
     * Delete a finished game's room WITHOUT touching player sessions.
     * Used for tournament matches: the TournamentService is the single source
     * of truth for tournament session state (next match / spectator / finish).
     */
    async disbandRoom(roomId: string): Promise<void>{
        await this.roomService.deleteRoom(roomId);
    }

    /*
     * Tears down a (non-tournament) room and resets each listed player:
     * removes them from the queue and resets their session to idle.
     */
    async cleanupRoom(roomId: string, userIds: string[]): Promise<void>{
        await this.roomService.deleteRoom(roomId);

        await Promise.all(
            userIds.map(async (userId) => {
                await this.matchService.leaveQueue(userId);
                await this.sessionService.update(userId, {
                    status: 'idle',
                    roomId: undefined,
                    gameId: undefined,
                })
            })
        )
    }

    /*
     * Creates a solo-vs-AI game: builds a 2-seat room (human + an ai_ player)
     * and starts the match, returning the live MultiGameState.
     */
    async createAIGame(userId: string, nickname: string, category?: string): Promise<MultiGameState>{
        //1. create a room for this session
        //2. init player with the ia 
        const humanId = String(userId);
        const aiId = `ai_${crypto.randomUUID()}`;

        const room = await this.roomService.createRoom({
            hostId: humanId,
            hostNickname: nickname,
            maxPlayers: 2,
            players:[
                {userId: humanId, nickname},
                {userId: aiId, nickname: 'AI'}
            ],
            AIplayerIds: [aiId]
        })
        const state = await this.multiService.startGame(room, category);
        return state as MultiGameState
    }
}

/***
 *  facade combine all for multiplayer game 
 *  -matchmaking system for players
 *  -room management
 *  -ready state coordination
 *  -game startup
 *  -reconnection handle
 *  - tournament integration
 *  - session synchronization
 *  - websocket notifications
 * 
 * 
 */
