import { Router } from 'express';
import { GameController } from './game.controller';
// import { verifyToken } from 'src/middleware/verify_token';


const router = Router();
const gameRouter = new GameController();

// router.use(verifyToken);

router.get('/:mode/start', GameController.start);
router.post('/:mode/:gameId/answer', GameController.answer);

export const gameRouter = router;

