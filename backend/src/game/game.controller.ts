import { Request, Response } from 'express';
import { GameService } from './game.factory';
import { AppError, ErrorCode } from 'src/error/apperror';
import { Apiresponse } from 'src/lib/api_response';

export class GameController
{
    constructor(
        private gameService: GameService
    ){}
    start = async(req: Request, res: Response)=>
    {
        try{
            const result = await this.gameService.startGame({
                mode: req.params.mode,
                userId: req.user.id,
                nickname: req.user.username
            })
            if (!result) {
                return res.status(500).json(
                    Apiresponse.success(null, "failed to start")
                );
            }
            if ('status' in result && result.status === 'waiting'){
                return res.status(202).json(
                    Apiresponse.success(null, "Waiting for match")
                )
            }
            if ('status' in result && result.status === 'matched'){
                return res.status(200).json(
                    Apiresponse.success(result, 'Match found and game started')
                )
            }

            res.status(200).json(
                Apiresponse.success(result, "Solo game start")
            );
        }catch(error){
            console.error(error);

            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                );
            }
            return res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal start game")
            )
        }
    }

    setready = async(req: Request, res: Response) => {
        const roomId = req.params.roomId;
        const isReady = req.body.isReady;
        const userId = req.user.id;
        try{
            const result = await this.gameService.setReady(roomId, userId, isReady);

            if (!result) {
                return res.status(200).json(
                    Apiresponse.error(
                        "Waiting for other players",
                        ErrorCode.MULTI_WAIT_OTHER_PLAYERS)
                );
            }

            return res.status(200).json(
                Apiresponse.success(result, "set ready and game started")
            );
        }catch(error){
            console.error(error);

            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                );
            }
            return res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal set ready")
            )
        }
    }

    answer = async (req: Request, res: Response): Promise<void> => {
        const userId = req.user.id;

        const gameId = req.params.gameId;

        if (!gameId) {
            return res.status(400).json(
                Apiresponse.error("MISSING_GAME_ID", "Gameid is required")
                );
        }

        const rawAnswer = req.body.selectedAnswerIndex;
        const selectedAnswerIndex = Number(rawAnswer);

        if (!Number.isInteger(selectedAnswerIndex)) {
            return res.status(400).json(
                Apiresponse.error("INVALIDE_ANSWER_INDEX", "selectedAnswerIndex must be an integer.")
                );
        }

        try {
            const result = await this.gameService.submitAnswer(gameId, selectedAnswerIndex, userId);

            if (!result) {
                return res.status(404).json(
                    Apiresponse.error("GAME_NOT_FOUND", "Game not found")
                    );
            }

            return res.status(200).json(
                Apiresponse.success(result, result.gameresult.isFinished ? "Game finished." : "Answer submitted.")
                );
        } catch (error) {
            console.error(error);
            if (error instanceof AppError) {
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                )
            }

            return res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal submit answer")
            );
        }
    }
}
