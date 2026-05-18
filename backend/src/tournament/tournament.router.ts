import { Router } from "express";
import { verifyToken } from "../middleware/verify_token";
import { TournamentController } from "./tournament.controller";
import { TournamentService } from "./tournament.service";

export function createTournamentRouter(tournamentService: TournamentService): Router {
    const router = Router();
    const controller = new TournamentController(tournamentService);

    router.use(verifyToken);
    router.post('/join', controller.join);
    router.get('/:tournamentId', controller.bracket);

    return router;
}
