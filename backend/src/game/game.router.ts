import { Router } from 'express';
import { GameController } from './game.controller';

const gameRouter = Router();

gameRouter.get('/start', GameController.start);
gameRouter.post('/:gameId/answer', GameController.answer);
gameRouter.get('/:gameId/answer', GameController.answer);

export default gameRouter;
