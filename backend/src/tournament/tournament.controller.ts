import { Request, Response } from "express";
import { Apiresponse } from "../lib/api_response";
import { AppError } from "../error/apperror";
import { TournamentService } from "./tournament.service";

export class TournamentController {
    constructor(private tournamentService: TournamentService) {}

    /* POST /join handler. Queues the caller; 200 if a tournament started, else 202 waiting. */
    join = async (req: Request, res: Response) => {
        try {
            const userId = String(req.user!.id);
            const nickname = req.user!.username;
            const result = await this.tournamentService.joinQueue(userId, nickname);
            if (result.status === 'waiting') {
                return res.status(202).json(Apiresponse.success(result, "Waiting for tournament players"));
            }
            return res.status(200).json(Apiresponse.success(result, "Tournament started"));
        } catch (error) {
            console.error(error);
            if (error instanceof AppError) {
                return res.status(error.statusCode).json(Apiresponse.error(error.code, error.message));
            }
            return res.status(500).json(Apiresponse.error("INTERNAL_ERROR", "Internal tournament join"));
        }
    }

    /* POST /leave handler. Removes the caller from their tournament (forfeit if needed). */
    leave = async (req: Request, res: Response) => {
        try {
            const userId = String(req.user!.id);
            await this.tournamentService.leave(userId);
            return res.status(200).json(Apiresponse.success(null, "Left tournament"));
        } catch (error) {
            console.error(error);
            return res.status(500).json(Apiresponse.error("INTERNAL_ERROR", "Internal tournament leave"));
        }
    }

    /* GET /my/room handler. Returns the caller's current ready match room id, if any. */
    myRoom = async (req: Request, res: Response) => {
        try {
            const userId = String(req.user!.id);
            const state = await this.tournamentService.getByUser(userId);
            if (!state || state.status === 'finished') {
                return res.status(200).json(Apiresponse.success({ roomId: null }, "No active tournament room"));
            }
            const match = state.matches.find(m =>
                (m.p1 === userId || m.p2 === userId) && m.status === 'ready'
            );
            return res.status(200).json(Apiresponse.success({
                roomId: match?.roomId ?? null,
                tournamentId: state.tournamentId,
            }, "Tournament room"));
        } catch (error) {
            console.error(error);
            return res.status(500).json(Apiresponse.error("INTERNAL_ERROR", "Internal tournament my-room"));
        }
    }

    /* GET /:tournamentId/onchain handler. Returns the tournament's on-chain scores; 404 if none. */
    onchain = async (req: Request, res: Response) => {
        try {
            const id = req.params.tournamentId as string;
            const scores = await this.tournamentService.getOnchainScores(id);
            if (!scores) {
                return res.status(404).json(Apiresponse.error("ONCHAIN_NOT_FOUND", "No on-chain record for this tournament"));
            }
            return res.status(200).json(Apiresponse.success(scores, "On-chain tournament scores"));
        } catch (error) {
            console.error(error);
            return res.status(500).json(Apiresponse.error("INTERNAL_ERROR", "Internal tournament onchain"));
        }
    }

    /* GET /:tournamentId handler. Returns the public bracket view; 404 if unknown. */
    bracket = async (req: Request, res: Response) => {
        try {
            const id = req.params.tournamentId as string;
            const view = await this.tournamentService.getPublic(id);
            if (!view) {
                return res.status(404).json(Apiresponse.error("TOURNAMENT_NOT_FOUND", "Tournament not found"));
            }
            return res.status(200).json(Apiresponse.success(view, "Tournament bracket"));
        } catch (error) {
            console.error(error);
            if (error instanceof AppError) {
                return res.status(error.statusCode).json(Apiresponse.error(error.code, error.message));
            }
            return res.status(500).json(Apiresponse.error("INTERNAL_ERROR", "Internal tournament bracket"));
        }
    }
}
