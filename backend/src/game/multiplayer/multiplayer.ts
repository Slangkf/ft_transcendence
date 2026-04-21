import { GameBaseService } from "../game.base";
import { GameInfo, IModeService, StartGameResult } from "../game.types";
import { AppError, ErrorCode } from "src/error/apperror";
import { RoomManager } from "src/room/room.manager";
import { RedisGameRepository } from "../game.redis.repository";
import type { Room, RoomPlayer } from "src/room/room.types";

export class MultiPlayer extends GameBaseService implements IModeService{
    private roommanager: RoomManager;
    constructor(){
        this.roommanager = new RoomManager();
    }

    public async startGame(userId: string): Promise<StartGameResult | null> {
        //1. give a room by roommanager(need to add the user in waiting list, and give him a room)
        const room = this.roommanager.getroomByUser(userId);
        if (!room)  throw new AppError(
            "room not exist",
            ErrorCode.ROOM_NOT_FOUND,
        )
        //check if the user is a host 
        if (room.hostId )
        //check if the status of the room is waiting(normal the roommanager check if all players are ready )
        //2. prepare the questions 
        //3. create a gamestate
        //4. add gameid in room

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