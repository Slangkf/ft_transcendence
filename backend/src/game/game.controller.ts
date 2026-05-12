import { Request, Response } from 'express';
import { GameService } from './game.service';
import { AppError, ErrorCode } from 'src/error/apperror';
import { Apiresponse } from 'src/lib/api_response';
import { GameMode } from './game.types';

export class GameController
{
    constructor(
        private gameService: GameService
    ){}
    start = async(req: Request, res: Response)=>
    {
        try{
            const rawmode = req.params.mode; 
            const mode = rawmode === 'multiplayer' ? GameMode.MULTIPLAYER
               : rawmode === 'solo'        ? GameMode.SOLO
               : null;

            if (!mode) {
                return res.status(400).json(
                     Apiresponse.error('INVALID_MODE', 'Invalid game mode')
                );
            }

            const rawCategory = req.body?.category;
            const category = typeof rawCategory === 'string' && rawCategory.trim().length > 0
                ? rawCategory.trim()
                : undefined;
            const rawSize = req.body?.size;
            const size = rawSize !== undefined ? Number(rawSize) : undefined;

            const result = await this.gameService.startGame({
                mode,
                userId: req.user!.id,
                nickname: req.user!.username ?? (req.user as any).nickname ?? `Player ${req.user!.id}`,
                category,
                size,
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

    categories = async(_req: Request, res: Response) => {
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
        const roomId = req.params.roomId as string;
        const isReady = req.body.isReady;
        const userId = req.user!.id;
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
        const userId = req.user!.id;

        const gameId = req.params.gameId as string;

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
