import { Request, Response } from 'express';
//import { IModeService } from 'game/game.types';
//import { GameRepository } from './';
//import { SoloService } from './solo';
// import { MultiplayerService } from './multiplayer'; // uncomment when ready
// import { IAService } from './ia';                   // uncomment when ready

//const repo = new GameRepository();
//
//const modeInstances: Record<string, IModeService> = {
//    solo: new SoloService(repo),
//    // multiplayer: new MultiplayerService(repo),
//    // ia: new IAService(repo),
//};
//
//function getModeService(mode: string): IModeService | null
//{
//    return modeInstances[mode] ?? null;
//}

import { GameServiceFactory } from './game.factory';
export class GameController
{
    public static async start(req: Request, res: Response): Promise<void>
    {
        const service = GameServiceFactory.get(req.params.mode);
        const userId = req.user; // userid is in httponly cookie 
        if (!service)
        {
            res.status(400).json({
                success: false,
                message: `Unknown game mode: ${req.params.mode}`,
                data: null,
            });
            return;
        }

        const game = await service.startGame(userId);

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

    public static async answer(req: Request, res: Response): Promise<void>
    {
        const service = GameServiceFactory.get(req.params.mode);
        const userId = req.user;
        if (!service)
        {
            res.status(400).json({
                success: false,
                message: `Unknown game mode: ${req.params.mode}`,
                data: null,
            });
            return;
        }

        const gameId = req.params.gameId;

        if (!gameId)
        {
            res.status(400).json({
                success: false,
                message: 'gameId is required.',
                data: null,
            });
            return;
        }

        const rawAnswer = req.body?.selectedAnswerIndex ?? req.query.selectedAnswerIndex;
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

        const result = await service.submitAnswer(gameId, selectedAnswerIndex, userId);

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
