import { GameInfo, MatchPlayer, PublicGameState, StartGameResult } from "src/game/game.types";
import {SendFriendRequestInput} from "@shared/friendship.schema";


export type GameSocketEvents = {
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

export type FriendSocketEvents = {
    'friend_request':{
        fromuserId: string;
        fromNickname: string;
    };

    'friend_accept':{
        userId: string;
        nickname: string;
    };

    'friend_online':{
        userId: string;
    };
    'friend_offline':{
        userId: string;
    }
}

export type ChatSocketEvents ={

}