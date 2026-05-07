import { GameMode } from "../game.types";

export type JoinQueueParams = {
    mode: GameMode,
    userId: string,
    nickname: string,
}

export type QueuePlayer = {
    userId: string;
    nickname: string;
    jointedAt: number;
}

export type MathQueueResult = {
    status: "in queue";
    position: number;
}
export type MatchResult = {
    players: QueuePlayer[];
    matchId: string;
    roomId: string;
    mode: string;
    maxPlayers: number;
    createdAt: number;
}