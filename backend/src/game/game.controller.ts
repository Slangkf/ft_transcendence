import { Request, Response } from 'express';
import { GameServiceFactory } from './game.factory';
import { AppError } from 'src/error/apperror';
import { Apiresponse } from 'src/lib/api_response';

export class GameController
{
    public static async start(req: Request, res: Response): Promise<void>
    {
        const service = GameServiceFactory.get(req.params.mode);
        // const userId = req.user.id; // userid is in httponly cookie 
        const userId = req.user?.id ?? 1;

        if (!service)
        {
           return res.status(400).json(
                Apiresponse.error(
                    "UNKNOWN_GAME_MODE",
                     `Unknown game mode: ${req.params.mode}`)
                );
        }

        try{
            const game = await service.startGame(userId);
            res.status(201).json(
                Apiresponse.success(game, "Game started")
            );
        }catch(error){
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                );
            }
            return res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal start solo game")
            )
        } 
    }

    public static async answer(req: Request, res: Response): Promise<void>
    {
        const service = GameServiceFactory.get(req.params.mode);
        // const userId = req.user.id;
        const userId = req.user?.id ?? 1;

        if (!service)
        {
            return res.status(400).json(
                Apiresponse.error("UNKOWN_GAME_MODE", `Unknown game mode: ${req.params.mode}`)
            );
        }

        const gameId = req.params.gameId;

        if (!gameId)
        {
            return res.status(400).json(
                Apiresponse.error("MISSING_GAME_ID", "Gameid is required")
                );
        }

        const rawAnswer = req.body?.selectedAnswerIndex ?? req.query.selectedAnswerIndex;
        const selectedAnswerIndex = Number(rawAnswer);

        if (!Number.isInteger(selectedAnswerIndex))
        {
            return res.status(400).json(
                Apiresponse.error("INVALIDE_ANSWER_INDEX", 'selectedAnswerIndex must be an integer.')
                );
        }

        try{
            const result = await service.submitAnswer(gameId, selectedAnswerIndex, userId);

            if (!result)
            {
                return res.status(404).json(
                    Apiresponse.error("GAME_NOT_FOUND", "Game not found")
                    );
            }

            return res.status(200).json(
                Apiresponse.success(result, "result.gameresult.isFinished ? 'Game finished.' : 'Answer submitted.'")
                );
        }catch (error){
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                    )
            }
            
            return res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal start solo game")
            )
        }
    }
}
