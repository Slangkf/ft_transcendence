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
import { GameMapper } from "./game/game.mapper";
import { PrismaGameRepository } from "./game/game.score";


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
    public db!: PrismaGameRepository;

    //service 
    public questionService!: QuestionService;
    public userService!: UserService;
    public authService!: AuthService;
    public matchService!: MatchService;
    public roomService!: RoomService;
    public soloService!: SoloService;
    public localMultiPlayer!: LocalMultiPlayer;
    public multiplayerFacade!: MultiPlayerFacade;
    public gameService!: GameService;
    public sessionService!: SessionService;
    public friendService!: FriendshipService;
    public chatService!: ChatService; 
    public gamemapper!: GameMapper;

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
        this.db = new PrismaGameRepository(this.prisma);

        //initialise services without dependance
        this.questionService = new QuestionService(this.questionRepo);
        this.userService = new UserService(this.userRepo);
        this.authService = new AuthService(this.userRepo);
        this.matchService = new MatchService(this.matchRepo);
        this.roomService = new RoomService(this.roomRepo);
        this.soloService = new SoloService(this.questionService, this.gameRepo);
        this.localMultiPlayer = new LocalMultiPlayer(this.questionService, this.gameRepo);
        this.sessionService = new SessionService();

        //init the emitter
        this.gameEmitter = new GameEmitter(io, redis);
        this.friendEmitter = new FriendEmitter(io, redis);
        this.chatEmitter = new ChatEmitter(io, redis);

        this.gamemapper = new GameMapper(this.questionService);

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
        );
        //gameservice
        this.gameService = new GameService(
            this.soloService,
            this.multiplayerFacade,
            this.gameRepo,
            this.questionService,
            this.db,
            this.gamemapper,
        )
        
        //friendshipservice
        this.friendService = new FriendshipService(
            this.friendRepo,
            this.userRepo,
            this.friendEmitter,
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
            this.gamemapper,
        );

        this.friendSocketHandler = new FriendSocketHandler(
            friendNs,
            redis,
            this.friendEmitter,
            this.friendService,
            this.userRepo
        );

        this.chatSocketHandler = new ChatSocketHandler(
            chatNs,
            this.chatService
        )
    }
}
export const container = Container.getInstance();