import { Router } from "express";
import { verifyToken } from "../middleware/verify_token";
import { TournamentController } from "./tournament.controller";
import { TournamentService } from "./tournament.service";

/*
 * Builds the /tournament router (behind verifyToken): join/leave the queue,
 * fetch the caller's current match room, and read a bracket or its on-chain scores.
 */
export function createTournamentRouter(tournamentService: TournamentService): Router {
    const router = Router();
    const controller = new TournamentController(tournamentService);

    router.use(verifyToken);
    router.post('/join', controller.join);
    router.post('/leave', controller.leave);
    router.get('/my/room', controller.myRoom);
    router.get('/:tournamentId/onchain', controller.onchain);
    router.get('/:tournamentId', controller.bracket);

    return router;
}
