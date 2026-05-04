import { AuthService } from "./auth/auth.service";
import { GameService } from "./game/game.factory";
import { RedisGameRepository } from "./game/game.redis.repository";
import { MatchRepository } from "./game/multiplayer/match/match.repository";
import { MatchService } from "./game/multiplayer/match/match.service";
import { MultiService } from "./game/multiplayer/multi";
import { Multiplayer } from "./game/multiplayer/multiplayer";
import { SoloService } from "./game/solo/solo";
import { QuestionRepository } from "./question/question.repository";
import { QuestionService } from "./question/question.service";
import { RoomManager } from "./room/room.manager";
import { RoomRepository } from "./room/room.repository";
import { RoomService } from "./room/room.service";
import { UserRepository } from "./User/user.repository";
import { UserService } from "./User/user.service";
import { IEmitter } from "./websocket/socket.emitter";

// repo 
const questionrepo = new QuestionRepository();
const userrepo = new UserRepository();
const matchrepo = new MatchRepository();
export const gamerepo = new RedisGameRepository();
const roomrepo = new RoomRepository();

// game services
const questionService = new QuestionService(questionrepo);
export const matchService = new MatchService(matchrepo);
const roomService = new RoomService(roomrepo);

export const roomManager = new RoomManager(roomService);
const multiService = new MultiService(gamerepo, questionService);
const soloService = new SoloService(gamerepo, questionService);

//user service 
export const userService = new UserService(userrepo);
export const authService = new AuthService(userrepo);

export function createGameServices(emitter: IEmitter){

const multiPlayer = new Multiplayer(
    matchService,
    roomManager,
    multiService,
    emitter,
);

const gameService = new GameService(
    soloService,
    multiPlayer,
    gamerepo
);
return {multiPlayer, gameService};
}


