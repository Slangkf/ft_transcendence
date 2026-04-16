import { Router } from 'express';
import { GameController } from './game.controller';

const gameRouter = Router();

gameRouter.get('/:mode/start', GameController.start);
gameRouter.post('/:mode/:gameId/answer', GameController.answer);
gameRouter.get('/:mode/:gameId/answer', GameController.answer);

export default gameRouter;
