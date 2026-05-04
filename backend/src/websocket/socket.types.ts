import { GameInfo, MatchPlayer, PublicGameState, StartGameResult } from "src/game/game.types";

export type SocketEvent = {
    //match making before start multiplayer game 
    'matched': {
        roomId: string;
        players: MatchPlayer;
    };

    'player_ready':{
        playerId: string;
        isReady: boolean;
        allReady: boolean;
    };
    'game_started': StartGameResult;

    'answer_result': GameInfo;
    'player_left':{
        playerId: string;
        newHostId: string;
    }

    'reconnection':{
        roomId: string;
        gameId: string;
        state: PublicGameState //???? public or no 
    }
}