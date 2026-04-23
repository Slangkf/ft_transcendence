import { AppError, ErrorCode } from "src/error/apperror";
import { IModeService, StartGameParms, StartGameResult } from "./game.types";
import { Multiplayer } from "./multiplayer/multiplayer";
import { SoloService } from "./solo/solo";
import { RoomManager } from "src/room/room.manager";


export class GameServiceFactory implements IModeService{
    constructor(
        private soloService: SoloService,
        private multiplayer: Multiplayer
    ){}

    async startGame(params: StartGameParms): Promise<StartGameResult | null> {
        const {mode, userId, nickname} = params;

        switch(mode){
            case "solo":
                return this.soloService.startGame(userId);
            case "multi":
                return this.multiplayer.startMultiGame(mode, userId, nickname);
            default:
                throw new AppError(
                    "Unkown game mode",
                    ErrorCode.GAME_UNKOWN_MODE,
                    400
                )
        }
    }
}