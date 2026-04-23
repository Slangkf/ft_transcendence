import { MultiService } from "./multi";
import  type {
    StartGameResult
}from "../game.types"; 
import { AppError, ErrorCode } from "src/error/apperror";
import { Room } from "src/room/room.types";
import { RoomManager } from "src/room/room.manager";
import { MatchService } from "src/game/multiplayer/match/match.service";


export class Multiplayer {
    constructor(
        private matchservice: MatchService,
        private roommanager: RoomManager,
        private multiservice: MultiService
    ){}

    //mode, nickname from input user, userid in req.body
    async startMultiGame(mode: string,userId: string, nickname: string): Promise<StartGameResult | null>{
        const jointqueue = await this.matchservice.joinQueue({
            mode: mode,
            userId: userId,
            nickname: nickname
        })
        const match = await this.matchservice.matchPlayers(mode);
        const room = await this.roommanager.createRoom({
            hostId: userId,
            hostNickname: nickname
        })
        const result = await this.multiservice.startGame(room);
        room.status = "in_game";
        room.gameId = result?.gameId;
        
        //save in database
        await this.roommanager.updatestatus(room, "in_game");
        return result;
    }
}
/****
 * the layer to make multiplayer and room together(?? multiplayer entry by here or game? )
 * need to add websocket service with it 
 */