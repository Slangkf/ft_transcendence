
export type JoinQueueParams = {
    mode: string,
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
}