import { Router } from "express";
import { GameController } from "./game.controller";
import { GameService } from "./game.service";
import { verifyToken } from "../middleware/verify_token";
import { valideRequest } from "src/middleware/zod_check";
import {StartGameReq, 
        SetReadyParams,
        SubmitAnswerReqSchema,
} from '@shared/game.schema';



export function createGameRouter(gameService: GameService): Router{

    const router = Router();
    const gamecontroller = new GameController(gameService);

    router.use(verifyToken);

    router.get('/categories', gamecontroller.categories);
    router.post('/:mode/start', valideRequest(StartGameReq), gamecontroller.start);
    router.post('/:mode/ready/:roomId', valideRequest(SetReadyParams), gamecontroller.setready);
    router.get('/ai/:gameId/status', gamecontroller.getStatus);
    router.post('/:mode/:gameId/answer', valideRequest(SubmitAnswerReqSchema), gamecontroller.answer);
    return router;
}