import { GameBaseService } from "../game.base";
import { GameInfo, IModeService, StartGameResult } from "../game.types";
import { AppError, ErrorCode } from "src/error/apperror";

export class MultiPlayer extends GameBaseService implements IModeService{
    
    public async startGame(userId: string): Promise<StartGameResult | null> {
        
    }

    public async submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameInfo | null> {
        
    }
}


/****
 *  1. need timecalcule to find which player is faster
 *  2. need room to join (how? ), cannot joint since the game start 
 *  3. timeout????
 *  4. room clare: in 5min no response, delete room
 *  5. deconnecte： need a timer to connecte again, failed: the player in the room win 
 * 
 */