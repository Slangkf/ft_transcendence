import type { FinalScore, GameUpdateResponse, MatchPlayer, PlayerSnapShot, PublicQuestion } from "$lib/shared/game.schema";

// Possible states of a multiplayer room
export type RoomStatus = "waiting" | "active" | "closed" | "starting";

// Information about a player inside a room
export type RoomPlayerInfo = {
    id: string;
    nickname: string;
    isReady: boolean;
};

// Payload returned when reconnecting to the multiplayer system
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

// Payload sent when players are matched together
export type MatchPayload = {
    roomId: string;
    players: MatchPlayer[];
}

// Payload emitted when a player changes readiness state
export type PlayerReadyPayload = {
    playerId: string;
    isReady: boolean;
    allReady: boolean;
}

// Payload emitted when the game starts
export type GameStartedPayload = {
    gameId: string;
    firstQuestion: PublicQuestion;
    players: Record<string, PlayerSnapShot>;
}

// Payload emitted after a player submits an answer
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

// Payload emitted when a game is finished
export type GameFinishedPayload = {
    gameId: string;
    state: GameUpdateResponse;
}

// Payload emitted when a player leaves the room
export type PlayerLeftPayload = {
    playerId: string;
    newHostId: string;
}

// Payload confirming answer submission
export type AnswerSubmitPayload = {
    success: boolean;
}

// Generic socket event map
export type SocketEvents = Record<string, (data: any) => void>;

// Events emitted from the server to the client
export interface ServerToClientEvents {
    'matched': (data: MatchPayload) => void;

    'player_ready': (data: PlayerReadyPayload) => void;

    'game_started': (data: GameStartedPayload) => void;

    'answer_submitted': (data: AnswerSubmitPayload) => void;
    'answer_result': (data: AnswerResultPayload) => void;

    'game_finished': (data: GameFinishedPayload) => void;

    'player_left': (data: PlayerLeftPayload) => void;

    'reconnect': (data: ReconnectLoad) => void;
    'error': (data: {
        message: string;
    }) => void;
}

// Events emitted from the client to the server
export interface ClientToServerEvents {
    submit_answer: (data: {
        gameId: string;
        answerIndex: number;
    }) => void;

    //ready: (data: {
    //    roomId: string;
    //    isReady: boolean;
    //})
}

// Friend system socket events
export interface FriendSocketEvents {
    'friend_request': (data: {
        fromUserId: string;
        fromNickname: string;
    }) => void;

    'friend_accept': (data: {
        userId: string;
        nickname: string;
    }) => void;

    'friend_online': (data: {
        userId: string;
        nickname: string;
    }) => void;

    'friend_offline': (data: {
        userId: string;
        nickname: string;
    }) => void;
}

// Chat system socket events
export interface ChatSocketEvents {
    'message_received': (data: {
        messageId: string;
        fromUserId: string;
        content: string;
        createdAt: number;
    }) => void;

    'message_send': (data: {
        messageId: string;
        toUserId: string;
        content: string;
        createdAt: number;
    }) => void;

    'history': (data: {
        withUserId: string;
        message: any[];
    }) => void;

    'error': (data: {
        message: string;
    }) => void;
}
