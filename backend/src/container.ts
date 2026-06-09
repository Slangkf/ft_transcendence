import { Namespace } from "socket.io";
import { AuthService } from "./auth/auth.service";
import { ChatRepository } from "./chat/chat.repository";
import { ChatService } from "./chat/chat.service";
import { FriendshipController } from "./friendship/friendship.controller";
import { FriendshipRepository } from "./friendship/friendship.repository";
import { FriendshipService } from "./friendship/friendship.service";
import { LocalMultiPlayer } from "./game/game.local";
import { MultiPlayerFacade } from "./game/game.multi";
import { RedisGameRepository } from "./game/game.redis.repository";
import { GameService, GameStartResult } from "./game/game.service";
import { SoloGameState } from "./game/game.types";
import { MatchRepository } from "./game/match/match.repository";
import { MatchService } from "./game/match/match.service";
import { SessionService } from "./game/session.service";
import { SoloService } from "./game/solo";
import { AIService } from "./game/ai";
import { QuestionRepository } from "./question/question.repository";
import { QuestionService } from "./question/question.service";
import { RoomRepository } from "./room/room.repository";
import { RoomService } from "./room/room.service";
import { UserRepository } from "./User/user.repository";
import { UserService } from "./User/user.service";
import { ChatSocketHandler } from "./websocket/socket.chatHandler";
import { ChatEmitter, FriendEmitter, GameEmitter } from "./websocket/socket.emitter";
import { FriendSocketHandler } from "./websocket/socket.FriendHandler";
import { GameSocketHandler } from "./websocket/socket.gamehandler";
import { Redis } from "./lib/redis";
import { ChatController } from "./chat/chat.controller";
import { createAuthRouter } from "./auth/auth.router";
import { createUserRouter } from "./User/user.router";
import { AnyTlsaRecord } from "dns";
import { createGameRouter } from "./game/game.router";
import { createFriendshipRouter } from "./friendship/friendship.router";
import { createChatRouter } from "./chat/chat.router";
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { TournamentRepository } from "./tournament/tournament.repository";
import { TournamentService } from "./tournament/tournament.service";
import { createTournamentRouter } from "./tournament/tournament.router";
import { GameMapper } from "./game/game.mapper";
import { PrismaGameRepository } from "./game/game.score";
import { QuestionTimerService } from "./game/question-timer.service";
import { ReadyTimerService } from "./game/ready-timer.service";
import { BlockchainService } from "./blockchain/blockchain.service";


export class Container{
    private static instance: Container;
    private prisma = new PrismaClient();
    //repo
    public questionRepo!: QuestionRepository;
    public userRepo!: UserRepository;
    public matchRepo!: MatchRepository;
    public roomRepo!: RoomRepository;
    public gameRepo!: RedisGameRepository;
    public friendRepo!: FriendshipRepository;
    public chatRepo!: ChatRepository;
    public tournamentRepo!: TournamentRepository;
    public db!: PrismaGameRepository;

    //service 
    public questionService!: QuestionService;
    public userService!: UserService;
    public authService!: AuthService;
    public matchService!: MatchService;
    public roomService!: RoomService;
    public soloService!: SoloService;
    public aiService!: AIService;
    public localMultiPlayer!: LocalMultiPlayer;
    public multiplayerFacade!: MultiPlayerFacade;
    public gameService!: GameService;
    public sessionService!: SessionService;
    public friendService!: FriendshipService;
    public chatService!: ChatService;
    public tournamentService!: TournamentService;
    public gamemapper!: GameMapper;
    public questionTimer!: QuestionTimerService;
    public readyTimer!: ReadyTimerService;
    public blockchainService!: BlockchainService;

    //controller
    public friendController!: FriendshipController;
    public chatController!: ChatController;

    //socket emitter
    public gameEmitter!: GameEmitter;
    public friendEmitter!: FriendEmitter;
    public chatEmitter!: ChatEmitter;

    //socket handler
    public gameSocketHandler!: GameSocketHandler;
    public friendSocketHandler!: FriendSocketHandler;
    public chatSocketHandler!: ChatSocketHandler;

    //router
    public authRouter!: Router;
    public userRouter!: Router;
    public gameRouter: any;
    public friendRouter: any;
    public chatRouter: any;
    public tournamentRouter: any;

    private constructor(
        
    ){}

    public static getInstance(): Container{
        if (!Container.instance){
            Container.instance = new Container();
        }
        return Container.instance; 
    }

    public async initialize(io: any, gameNs: Namespace, friendNs: Namespace, chatNs: Namespace, redis: typeof Redis){
        //repo
        this.questionRepo = new QuestionRepository();
        this.userRepo = new UserRepository();
        this.matchRepo = new MatchRepository();
        this.roomRepo = new RoomRepository();
        this.gameRepo = new RedisGameRepository();
        this.friendRepo = new FriendshipRepository();
        this.chatRepo = new ChatRepository(this.prisma);
        this.tournamentRepo = new TournamentRepository();
        this.db = new PrismaGameRepository(this.prisma);
        this.aiService = new AIService();

        //initialise services without dependance
        this.questionService = new QuestionService(this.questionRepo);
        this.userService = new UserService(this.userRepo);
        this.authService = new AuthService(this.userRepo);
        this.matchService = new MatchService(this.matchRepo);
        this.roomService = new RoomService(this.roomRepo);
        this.soloService = new SoloService(this.questionService, this.gameRepo);
        this.localMultiPlayer = new LocalMultiPlayer(this.questionService, this.gameRepo, this.aiService);
        this.sessionService = new SessionService();
        this.gamemapper = new GameMapper();
        

        //init the emitter
        this.gameEmitter = new GameEmitter(io, redis);
        this.friendEmitter = new FriendEmitter(io, redis);
        this.chatEmitter = new ChatEmitter(io, redis);

        
        //per-question 30s deadline (server-authoritative)
        this.questionTimer = new QuestionTimerService(this.gameRepo);

        //per-room 60s readiness deadline (server-authoritative). 60s (not 45s) gives
        //comfortable margin for a player who reaches the room via the slower HTTP-poll
        //recovery path (when their socket events were lost) before being forfeited.
        this.readyTimer = new ReadyTimerService(60_000);

        //blockchain (Avalanche Fuji) — fail-soft if env is missing
        this.blockchainService = new BlockchainService();

        //multigamefacade
        this.multiplayerFacade = new MultiPlayerFacade(
            this.matchService,
            this.roomService,
            this.localMultiPlayer,
            this.sessionService,
            this.gameEmitter,
            gameNs,
            redis,
            this.gamemapper,
            this.questionTimer,
            this.readyTimer,
        );
        //gameservice
        this.gameService = new GameService(
            this.soloService,
            this.multiplayerFacade,
            this.gameRepo,
            this.questionService,
            this.db,
            this.gamemapper,
            this.aiService,
        )

        //tournament
        this.tournamentService = new TournamentService(
            this.tournamentRepo,
            this.matchService,
            this.roomService,
            this.sessionService,
            this.gameEmitter,
            gameNs,
            redis,
            this.readyTimer,
            this.blockchainService,
            this.questionTimer,
        );
        // wire tournament back into the multiplayer facade so room→game linking can notify the bracket
        this.multiplayerFacade.setTournamentService(this.tournamentService);
        // when a readiness deadline fires, resolve the stuck lobby (kick / forfeit)
        this.readyTimer.setTimeoutCallback((roomId) => this.multiplayerFacade.handleReadyTimeout(roomId));
        
        //friendshipservice
        this.friendService = new FriendshipService(
            this.friendRepo,
            this.userRepo,
            this.friendEmitter,
            this.chatEmitter,
            this.chatRepo,
        );
        this.friendController = new FriendshipController(this.friendService);

        //chat 
        this.chatService = new ChatService(
            this.chatEmitter,
            this.friendService,
            this.chatRepo
        );
        this.chatController = new ChatController(this.chatService);

        //router
        this.authRouter = createAuthRouter(this.authService);
        this.userRouter = createUserRouter(this.userService);
        this.gameRouter = createGameRouter(this.gameService);
        this.friendRouter = createFriendshipRouter(this.friendController);
        this.chatRouter = createChatRouter(this.chatController);
        this.tournamentRouter = createTournamentRouter(this.tournamentService);

        //sockethandler
        this.gameSocketHandler = new GameSocketHandler(
            gameNs,
            redis,
            this.roomService,
            this.matchService,
            this.gameRepo,
            this.gameEmitter,
            this.gameService,
            this.sessionService,
            this.tournamentService,
            this.gamemapper,
            this.questionTimer,
        );
        // when the deadline fires, route the new state through the same broadcast/cleanup
        // path used for a normal player answer
        this.questionTimer.setAdvanceCallback((state, opts) => this.gameSocketHandler.handlePostAnswer(state, opts));

        this.friendSocketHandler = new FriendSocketHandler(
            friendNs,
            redis,
            this.friendEmitter,
            this.friendService,
            this.userRepo
        );

        // After a restart, in-memory readiness timers are gone — re-arm pending
        // tournament deadlines so a match waiting on "Ready" can't hang forever.
        void this.tournamentService.rearmPendingDeadlines();

		this.chatSocketHandler = new ChatSocketHandler(
			chatNs,
			this.chatService,
			redis
		);
    }
}
export const container = Container.getInstance();