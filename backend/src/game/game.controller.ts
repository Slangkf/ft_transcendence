import { Request, Response } from 'express';
import { GameRepository } from './game.repository';
import { GameService } from './game.service';

const gameRepository = new GameRepository();
const gameService = new GameService(gameRepository);

export class GameController
{
    public static start(req: Request, res: Response): void
    {
        const game = gameService.startGame();

        if (!game)
        {
            res.status(200).json({
                success: false,
                message: 'No questions found.',
                data: null,
            });
            return;
        }

        res.status(201).json({
            success: true,
            message: 'Game started.',
            data: game,
        });
    }

    public static answer(req: Request, res: Response): void
    {
        const gameId = req.params.gameId;
    
// res = la réponse HTTP envoyée au client
// status(200) = code HTTP
// json(...) = convertit l’objet JavaScript en JSON et l’envoie au front
        if (!gameId)
        {
            res.status(400).json({
                success: false,
                message: 'gameId is required.',
                data: null,
            });
            return;
        }

        const rawAnswer = req.body.selectedAnswerIndex ?? req.query.selectedAnswerIndex;
        const selectedAnswerIndex = Number(rawAnswer);
    
        if (!Number.isInteger(selectedAnswerIndex))
        {
            res.status(400).json({
                success: false,
                message: 'selectedAnswerIndex must be an integer.',
                data: null,
            });
            return;
        }
    
        const result = gameService.submitAnswer(gameId, selectedAnswerIndex);
    
        if (!result)
        {
            res.status(404).json({
                success: false,
                message: 'Game not found.',
                data: null,
            });
            return;
        }
    
        res.status(200).json({
            success: true,
            message: result.isFinished ? 'Game finished.' : 'Answer submitted.',
            data: result,
        });
    }
}
