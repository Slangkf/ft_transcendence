import { Request, Response } from 'express';
import { GameServiceFactory } from './game.factory';
import { AppError } from 'src/error/apperror';
import { Apiresponse } from 'src/lib/api_response';

export class GameController
{
    constructor(
        private gamegate: GameServiceFactory
    ){}
    start = async(req: Request, res: Response)=>
    {
        const {mode} = req.body;
        try{
            const result = await this.gamegate.startGame({
                mode: req.body.mode,
                userId: req.user.id,
                nickname: req.user.username
            })
            res.status(201).json(
                Apiresponse.success(result, "Game started")
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

    //public static async answer(req: Request, res: Response): Promise<void>
    //{
    //    const service = GameServiceFactory.get(req.params.mode);
    //    const userId = req.user.id;
//
    //    if (!service)
    //    {
    //        return res.status(400).json(
    //            Apiresponse.error("UNKOWN_GAME_MODE", `Unknown game mode: ${req.params.mode}`)
    //        );
    //    }
//
    //    const gameId = req.params.gameId;
//
    //    if (!gameId)
    //    {
    //        return res.status(400).json(
    //            Apiresponse.error("MISSING_GAME_ID", "Gameid is required")
    //            );
    //    }
//
    //    const rawAnswer = req.body?.selectedAnswerIndex ?? req.query.selectedAnswerIndex;
    //    const selectedAnswerIndex = Number(rawAnswer);
//
    //    if (!Number.isInteger(selectedAnswerIndex))
    //    {
    //        return res.status(400).json(
    //            Apiresponse.error("INVALIDE_ANSWER_INDEX", 'selectedAnswerIndex must be an integer.')
    //            );
    //    }
//
    //    try{
    //        const result = await service.submitAnswer(gameId, selectedAnswerIndex, userId);
//
    //        if (!result)
    //        {
    //            return res.status(404).json(
    //                Apiresponse.error("GAME_NOT_FOUND", "Game not found")
    //                );
    //        }
//
    //        return res.status(200).json(
    //            Apiresponse.success(result, "result.gameresult.isFinished ? 'Game finished.' : 'Answer submitted.'")
    //            );
    //    }catch (error){
    //        if (error instanceof AppError){
    //            return res.status(error.statusCode).json(
    //                Apiresponse.error(error.code, error.message)
    //                )
    //        }
    //        
    //        return res.status(500).json(
    //            Apiresponse.error("INTERNAL_ERROR", "Internal start solo game")
    //        )
    //    }
    //}
}
