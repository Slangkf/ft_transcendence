import { GameMode } from "../game.types";

export type JoinQueueParams = {
    mode: GameMode,
    userId: string,
    nickname: string,
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
<<<<<<< HEAD:backend/src/game/multiplayer/match/match.types.ts
    mode: string;
    maxPlayers: number;
    createdAt: number;
=======
    mode: GameMode;
    maxPlayers: number;
    createdAt: number;
    notified: boolean;
>>>>>>> alice:backend/src/game/match/match.types.ts
}