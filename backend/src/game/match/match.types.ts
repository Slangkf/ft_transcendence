import {GameMode} from "@prisma/client"

export type JoinQueueParams = {
    mode: GameMode,
    userId: string,
    nickname: string,
    size: number,
}

export type QueuePlayer = {
    userId: string;
    nickname: string;
    joinedAt: number;
    mode: GameMode;
}

export type MatchPlayer = {
    userId: string;
    nickname: string;
}

export type MathQueueResult = {
    status: "in queue";
    position: number;
}
export type MatchResult = {
    players: MatchPlayer[];
    matchId: string;
    roomId: string;
    mode: GameMode;
    maxPlayers: number;
    createdAt: number;
    notified: boolean;
}