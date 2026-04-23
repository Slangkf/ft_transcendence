import { Router } from 'express';
import { GameController } from './game.controller';
import { verifyToken } from 'src/middleware/verify_token';


const router = Router();
const gamecontroller = new GameController();

router.use(verifyToken);

router.post('/:mode/start', gamecontroller.start);
//router.post('/:mode/:gameId/answer', gamecontroller.answer);

export const gameRouter = router;

