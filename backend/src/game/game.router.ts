import { Router } from 'express';
import { GameController } from './game.controller';
import { verifyToken } from 'src/middleware/verify_token';
import { GameService } from './game.factory';

export function createGameRouter(gameService: GameService): Router{

    const router = Router();
    const gamecontroller = new GameController(gameService);

    router.use(verifyToken);

    router.post('/:mode/start', gamecontroller.start);
    router.post('/:mode/ready/:roomId', gamecontroller.setready);
    router.post('/:mode/:gameId/answer', gamecontroller.answer);
    
    return router;
}
