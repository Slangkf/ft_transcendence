import {SendFriendRequestInput} from "@shared/friendship.schema";
import { string } from "zod/v4-mini";
import { RoomStatus } from "../room/room.types";
import { GameUpdateResponse, MatchPlayer, PlayerSnapShot } from "../game/game.types";
import { PublicQuestion } from "@shared/game.schema";

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
        correctText: string;
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

export type ServerToClientEvents = {
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

export type ClientToServerEvents = {
    submit_answer:(data: {
        gameId: string;
        answerIndex: number;
    }) => void;

    //ready: (data: {
    //    roomId: string;
    //    isReady: boolean;
    //})
}




export type FriendSocketEvents = {
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
    'message_received': (data: {
        messageId: string;
        fromUserId: string;
        toUserId: string;
        content: string;
        createdAt: number;
    }) => void;

    'message_send': (data:{
        messageId: string;
        toUserId: string;
        content: string;
        createdAt: number;
    }) => void;

    'history': (data:{
        withUserId: string;
        message: any[];
    }) => void;

    'error': (data: {
        message: string;
    }) => void;
}