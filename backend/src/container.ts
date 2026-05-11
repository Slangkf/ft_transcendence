import { emit } from "process";
import { AuthService } from "./auth/auth.service";
import { FriendshipRepository } from "./friendship/friendship.repository";
import { FriendshipService } from "./friendship/friendship.service";
import { GameService } from "./game/game.service";
import { RedisGameRepository } from "./game/game.redis.repository";
import { MatchRepository } from "./game/match/match.repository";
import { MatchService } from "./game/match/match.service";
import { MultiPlayerFacade } from "./game/game.multi";
import { SoloService } from "./game/solo";
import { QuestionRepository } from "./question/question.repository";
import { QuestionService } from "./question/question.service";
import { RoomManager } from "./room/room.manager";
import { RoomRepository } from "./room/room.repository";
import { RoomService } from "./room/room.service";
import { UserRepository } from "./User/user.repository";
import { UserService } from "./User/user.service";
import { FriendEmitter, GameEmitter, IEmitter } from "./websocket/socket.emitter";
import { SessionService } from "./game/session.service";
import { LocalMultiPlayer } from "./game/game.local";
import { Namespace } from "socket.io";
import { Redis } from "./lib/redis";
import { FriendshipController } from "./friendship/friendship.controller";

// repo 
const questionrepo = new QuestionRepository();
export const userrepo = new UserRepository();
const matchrepo = new MatchRepository();
export const gamerepo = new RedisGameRepository();
const roomrepo = new RoomRepository();

// game services
const questionService = new QuestionService(questionrepo);
export const matchService = new MatchService(matchrepo);
export const roomService = new RoomService(roomrepo);

//export const roomManager = new RoomManager(roomService);
const soloService = new SoloService(questionService, gamerepo);

//user service 
export const userService = new UserService(userrepo);
export const authService = new AuthService(userrepo);

export function createGameServices(emitter: GameEmitter,
    gameNs: Namespace,
    redis: typeof Redis,
){

const multiPlayer = new MultiPlayerFacade(
    matchService,
    roomService,
    new LocalMultiPlayer(questionService, gamerepo),
    new SessionService(),
    emitter,
    gameNs,
    redis,
);

const gameService = new GameService(
    soloService,
    multiPlayer,
    gamerepo
);
return {multiPlayer, gameService};
}

export function createFriendshipModule(emitter: FriendEmitter){
    const friendshipRepo = new FriendshipRepository();

    const friendshipService = new FriendshipService(
        friendshipRepo,
        userrepo,
        emitter
    );

    const friendshipController = new FriendshipController(friendshipService);

    return {
        friendshipService,
        friendshipController
    }
}