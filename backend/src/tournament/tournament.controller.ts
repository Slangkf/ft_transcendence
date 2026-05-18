import { Request, Response } from "express";
import { Apiresponse } from "../lib/api_response";
import { AppError } from "../error/apperror";
import { TournamentService } from "./tournament.service";

export class TournamentController {
    constructor(private tournamentService: TournamentService) {}

    join = async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
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
