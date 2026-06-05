import { Request, Response } from 'express';
import { GameService } from './game.service';
import { Apiresponse } from '../lib/api_response';
import { AppError, ErrorCode } from '../error/apperror';

export class GameController
{
    constructor(
        private gameService: GameService
    ){}

        start = async(req: Request, res: Response)=>
    {
        try{
            const {category, size, mode: gamemode} = req.validatedBody;
            const mode = gamemode === 'multiplayer' ? "MULTIPLAYER"
               : gamemode === 'ai' ? "AI"
               : 'SOLO';
            const result = await this.gameService.startGame({
                mode,
                userId: String(req.user!.id),
                nickname: req.user!.username,
                category: category,
                size: size,
            })
            if (!result) {
                return res.status(202).json(
                    Apiresponse.success(null, "waiting for match")
                );
            }
            if ('status' in result){
                if (result.status === 'waiting'){
                    return res.status(202).json(
                    Apiresponse.success(null, "Waiting for match")
                )}
                if (result.status === 'matched'){
                    return res.status(200).json(
                    Apiresponse.success(result, 'Match found and game started')
                )}
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

    categories = async(req: Request, res: Response) => {
        try {
            const categories = await this.gameService.listCategories();
            return res.status(200).json(Apiresponse.success(categories, "Categories list"));
        } catch(error) {
            console.error(error);
            if (error instanceof AppError) {
                return res.status(error.statusCode).json(Apiresponse.error(error.code, error.message));
            }
            return res.status(500).json(Apiresponse.error("INTERNAL_ERROR", "Internal categories list"));
        }
    }

    setready = async(req: Request, res: Response) => {
        const {roomId, isReady} = req.validatedBody;
        const userId = String(req.user!.id);
        try{
            const result = await this.gameService.setReady(roomId, userId, isReady);

            if (!result.allReady) {
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

    answer = async (req: Request, res: Response)=> {
        const userId = String(req.user!.id);

        const gameId = req.params.gameId as string;

        if (!gameId) {
            return res.status(400).json(
                Apiresponse.error("MISSING_GAME_ID", "Gameid is required")
                );
        }

        const rawAnswer = req.validatedBody?.selectedAnswerIndex ?? req.body.selectedAnswerIndex;
        const selectedAnswerIndex = Number(rawAnswer);
        const expectedQuestionId = req.validatedBody?.questionId === undefined
            ? undefined
            : Number(req.validatedBody.questionId);

        if (!Number.isInteger(selectedAnswerIndex) || selectedAnswerIndex < -1) {
            return res.status(400).json(
                Apiresponse.error("INVALIDE_ANSWER_INDEX", "selectedAnswerIndex must be an integer greater than or equal to -1.")
                );
        }

        try {
            const result = await this.gameService.submitAnswer(gameId, selectedAnswerIndex, userId, expectedQuestionId);

            if (!result) {
                return res.status(404).json(
                    Apiresponse.error("GAME_NOT_FOUND", "Game not found")
                    );
            }

            if (result.status === 'finished') {
                await this.gameService.finalize(gameId);
            }

            return res.status(200).json(
                Apiresponse.success(result, result.status === 'finished' ? "Game finished." : "Answer submitted.")
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
