import { Router } from 'express';
import { GameController } from './game.controller';
import { verifyToken } from 'src/middleware/verify_token';
import { GameService } from './game.factory';
import { SoloService } from './solo/solo';
import { Multiplayer } from './multiplayer/multiplayer';
import { RedisGameRepository } from './game.redis.repository';
import { QuestionService } from 'src/question/question.service';
import { MatchService } from './multiplayer/match/match.service';
import { RoomManager } from 'src/room/room.manager';
import { MultiService } from './multiplayer/multi';
import { RoomService } from 'src/room/room.service';
import { MatchRepository } from './multiplayer/match/match.repository';
import { QuestionRepository } from 'src/question/question.repository';
import { redis } from 'src/lib/redis';
import { RoomController } from 'src/room/room.controller';


const router = Router();
const repo = new RedisGameRepository();
const questionrepo = new QuestionRepository();
const question = new QuestionService(questionrepo);
const soloservice = new SoloService(repo, question);

const matchrepo = new MatchRepository();
const match = new MatchService(matchrepo);
const roomservice = new RoomService();
const roommanager = new RoomManager(roomservice);
const roomcontroller = new RoomController(roommanager)
const multi = new MultiService(repo, question);
const multiplayer  = new  Multiplayer(match, roommanager, multi);

const gameservice = new GameService(soloservice, multiplayer, repo);
const gamecontroller = new GameController(gameservice);

router.use(verifyToken);

router.post('/:mode/start', gamecontroller.start);
router.post('/:mode/ready/:roomId', gamecontroller.setready);
router.post('/:mode/:gameId/answer', gamecontroller.answer);

export const gameRouter = router;

