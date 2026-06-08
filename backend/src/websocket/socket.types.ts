import {SendFriendRequestInput} from "@shared/friendship.schema";
import { RoomStatus } from "../room/room.types";
import { GameUpdateResponse, MatchPlayer, PlayerSnapShot } from "../game/game.types";
import { PublicQuestion, SubmitAnswerReq } from "@shared/game.schema";
import { BracketMatch, PublicBracketView, TournamentPlayer } from "../tournament/tournament.types";

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
    startedAt: number;
}

export type AnswerResultPayload = {
    gameId: string;
    status: 'playing' | 'finished';
    lastAnswerUpdate?: {
        playerId: string;
        isCorrect: boolean;
        correctAnswerIndex: number;
        correctText: string;
    };
    timedOut?: boolean;
    nextQuestion?: PublicQuestion | null;
    players: Record<string, PlayerSnapShot>;
    finalScore?:{
        winnerId: string;
        finishedAt: number;
        scores: Record<string, number>; 
        ranking: Array<{playerId: string, nickname?: string, score: number, rank:number, totalTime: number}>;
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

    'session_reconnect': (data: ReconnectLoad)=> void;
    'error': (data: {
        message: string;
    }) => void;

    // tournament events
    'lobby_update': (data: LobbyUpdatePayload) => void;
    'tournament_started': (data: TournamentStartedPayload) => void;
    'bracket_update': (data: BracketUpdatePayload) => void;
    'next_match_ready': (data: NextMatchReadyPayload) => void;
    'tournament_finished': (data: TournamentFinishedPayload) => void;
    'tournament_onchain': (data: TournamentOnchainPayload) => void;
    'spectator_update': (data: SpectatorUpdatePayload) => void;
    // a player (or the whole room) failed to ready up in time
    'ready_timeout': (data: ReadyTimeoutPayload) => void;
}

export type ReadyTimeoutPayload = {
    roomId: string;
    excluded: boolean; // true if THIS recipient is the one who never readied
}

// Live snapshot of an ongoing tournament game, broadcast to the tournament room
// so eliminated players can spectate the final (scoreboard + question progress).
export type SpectatorUpdatePayload = {
    tournamentId: string;
    gameId: string;
    status: 'playing' | 'finished';
    currentQuestionIndex: number;
    totalQuestions: number;
    question?: PublicQuestion | null;
    players: Record<string, PlayerSnapShot>;
}

export type LobbyUpdatePayload = {
    size: number;
    players: { userId: string; nickname: string }[];
}

export type TournamentStartedPayload = {
    tournamentId: string;
    bracket: PublicBracketView;
}

export type BracketUpdatePayload = {
    tournamentId: string;
    bracket: PublicBracketView;
}

export type NextMatchReadyPayload = {
    tournamentId: string;
    roomId: string;
    opponentId: string;
    opponentNickname: string;
    round: number;
    players: { userId: string; nickname: string }[];
}

export type TournamentFinishedPayload = {
    tournamentId: string;
    bracket: PublicBracketView;
    winnerId: string;
    ranking: string[];
}

// Final scores were written on-chain; carries the tx hash + explorer link.
export type TournamentOnchainPayload = {
    tournamentId: string;
    txHash: string;
    explorerUrl: string;
}

export type ClientToServerEvents = {
    submit_answer:(
        data: SubmitAnswerReq,
         ack:(response: SubmitAnswerRes) => void
    ) => void;

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

    'friend_remove': (data: {
        userId: string;
        nickname: string;
    }) => void;
}

export type ChatSocketEvents ={
    'message_received': (data: {
        messageId: string;
        senderId: string;
        receiverId: string;
        content: string;
        createdAt: number;
    }) => void;

    'message_send': (data:{
        messageId: string;
        receiverId: string;
        content: string;
        createdAt: number;
    }) => void;

    'history': (data:{
        withUserId: string;
        message: any[];
    }) => void;

    'unread_count': (data: {
        perSender: {senderId: number; count: number}[];
    }) => void;

    'error': (data: {
        message: string;
    }) => void;
}

export type SubmitAnswerRes = {
    success: boolean;
    error?: string;
}