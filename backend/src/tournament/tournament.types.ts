export type BracketMatchStatus = 'pending' | 'ready' | 'playing' | 'done';

export type BracketMatch = {
    round: number;          // 1 = R1 (semi-finals for size 4), 2 = final
    slot: number;           // index inside the round (0 or 1 for R1, 0 for R2)
    p1?: string;            // userId
    p2?: string;            // userId
    p1Nickname?: string;
    p2Nickname?: string;
    roomId?: string;
    gameId?: string;
    winnerId?: string;
    status: BracketMatchStatus;
};

export type TournamentStatus = 'waiting' | 'running' | 'finished';

export type TournamentPlayer = {
    userId: string;
    nickname: string;
};

export type TournamentState = {
    tournamentId: string;
    size: number;           // for now: 4
    status: TournamentStatus;
    players: TournamentPlayer[];
    matches: BracketMatch[]; // for size=4: [R1m0, R1m1, R2m0]
    withdrawn: string[];     // userIds who forfeited mid-tournament
    finalRanking?: string[]; // userIds, winner first
    startedAt: number;
    finishedAt?: number;
};

export type PublicBracketView = {
    tournamentId: string;
    status: TournamentStatus;
    players: TournamentPlayer[];
    matches: BracketMatch[];
    finalRanking?: string[];
};
