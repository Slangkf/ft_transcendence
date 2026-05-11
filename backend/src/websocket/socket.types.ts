import {  GameUpdateResponse, MatchPlayer, PlayerSnapShot, PublicQuestion, StartGameResult } from "src/game/game.types";
import {SendFriendRequestInput} from "@shared/friendship.schema";
import { QueuePlayer } from "src/game/match/match.types";
import { string } from "zod/v4-mini";
import { RoomStatus } from "src/room/room.types";

export type RoomPlayerInfo = {
    id: string;
    nickname: string;
    isReady: boolean;
};
export type ReconnectLoad = 
    | {type: 'idle'}
    | {type: 'queue'; message: string}
    | {type: 'matched'; roomId: string; players: MatchPlayer[]}
    | {
        type: "in_room";
        roomId: string;
        players: RoomPlayerInfo[];
        roomStatus: RoomStatus; 
    }
    | {
        type: "in_game";
        gameId: string;
        state: GameUpdateResponse
    }

export type MatchPayload = {
    roomId: string;
    players: MatchPlayer[];
}

export type PlayerReadyPayload = {
    playerId: string;
    isReady: boolean;
    allReady: boolean;
}

export type GameStartedPayload = {
    gameId: string;
    firstQuestion: PublicQuestion;
    players: Record<string, PlayerSnapShot>;
}

export type AnswerResultPayload = {
    gameId: string;
    status: 'playing' | 'finished';
    lastAnswerUpdate: {
        playerId: string;
        isCorrect: boolean;
        correctAnswerIndex: number;
    };
    nextQuestion?: PublicQuestion | null;
    players: Record<string, PlayerSnapShot>;
    finalScore?:{
        winnerId: string;
        finishedAt: number;
        scores: Record<string, number>; 
        ranking: Array<{playerId: string, score: number, rank:number}>;
    } | null;
}

export type GameFinishedPayload = {
    gameId: string;
    state: GameUpdateResponse;
}

export type PlayerLeftPayload = {
    playerId: string;
    newHostId: string;
}

export type AnswerSubmitPayload = {
    success: boolean;
}

export type SocketEvents = Record<string, (data: any) => void>;

export interface ServerToClientEvents {
    //match making before start multiplayer game 
    'matched': (data: MatchPayload) => void;

    'player_ready':(data:PlayerReadyPayload) => void;

    'game_started': (data: GameStartedPayload) => void;

    'answer_submitted': (data: AnswerSubmitPayload) => void;
    'answer_result':(data: AnswerResultPayload) => void;

    'game_finished':(data: GameFinishedPayload) => void;

    'player_left':(data: PlayerLeftPayload) => void;

    'reconnect': (data: ReconnectLoad)=> void;
    'error': (data: {
        message: string;
    }) => void;
}

export interface ClientToServerEvents {
    submit_answer:(data: {
        gameId: string;
        answerIndex: number;
    }) => void;

    //ready: (data: {
    //    roomId: string;
    //    isReady: boolean;
    //})
}




export interface FriendSocketEvents {
    'friend_request':(data: {
        fromUserId: string;
        fromNickname: string;
    }) => void;

    'friend_accept':(data: {
        userId: string;
        nickname: string;
    }) => void;

    'friend_online':(data: {
        userId: string;
        nickname: string;
    }) => void;

    'friend_offline':(data: {
        userId: string;
        nickname: string;
    }) => void;
}

export type ChatSocketEvents ={

}