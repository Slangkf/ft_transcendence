import { Router } from 'express';
import { GameController } from './game.controller';



const router = Router();
const gameRouter = new GameController();


router.get('/:mode/start', GameController.start);
router.post('/:mode/:gameId/answer', GameController.answer);

export const gameRouter = router;
