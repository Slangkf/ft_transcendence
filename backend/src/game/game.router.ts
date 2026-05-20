import { Router } from "express";
import { GameController } from "./game.controller";
import { GameService } from "./game.service";
import { verifyToken } from "../middleware/verify_token";



export function createGameRouter(gameService: GameService): Router{

    const router = Router();
    const gamecontroller = new GameController(gameService);

    router.use(verifyToken);

    router.get('/categories', gamecontroller.categories);
    router.post('/:mode/start', gamecontroller.start);
    router.post('/:mode/ready/:roomId', gamecontroller.setready);
    router.post('/:mode/:gameId/answer', gamecontroller.answer);
    
    return router;
}