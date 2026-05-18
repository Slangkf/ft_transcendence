export type GameQuestion = {
    id: number;
    question: string;
    options: string[];
    correctAnswerIndex: number;
};

//public use to return for front
export type PublicQuestion = {
    id: number;
    question: string;
    options: string[];
};

export type PlayerAnswer = {
    questionId: number;
    selectedAnswerIndex: number; //remember the choice of player answer
    isCorrect: boolean;

    answeredAt?: number; // for multiplayer
}

export type PlayerStatus = "playing" | "answered" | "disconnected";

export interface Player{
    id: string;
    score: number;
    answers: PlayerAnswer[];
    status: PlayerStatus;
    Totaltime: number;
    isAI?: boolean;
    joinOrder?: number;
    nickname?: string;
}


export enum GameMode {
    SOLO = "solo",
    AI = "ai",
    MULTIPLAYER = "multiplayer",
    TOURNAMENT = "tournament",  
}
//runtime gamestate to save in redis 
export interface BaseGameState {
    gameId: string;
    mode: GameMode;
    questions: GameQuestion[];
    players: Record<string, Player>;
    currentQuestionIndex: number;
    isFinished: boolean;
    startedAt: number;
    questionStartedAt: number;
    roomId?: string;
    hostId?: string;
    status?: "waiting" | "starting" | "playing" | "finished";
}

export interface SoloGameState extends BaseGameState {
    mode: GameMode.SOLO | GameMode.AI
}

export interface MultiGameState extends BaseGameState {
    mode: GameMode.MULTIPLAYER | GameMode.TOURNAMENT;
    roomId: string;
    hostId: string;
    status: "waiting" | "starting" | "playing" | "finished";
    tournamentId?: string;
}

export type GameState = SoloGameState | MultiGameState; 

//informations for front 
export interface PlayerSnapShot{
    id: string;
    nickname?: string;
    score: number;
    status: PlayerStatus;
    isAI: boolean;
    totalTime?: number;
}

export type FinalScore = {
    winnerId: string;
    finishedAt: number;
    scores: Record<string, number>;
    ranking: Array<{playerId: string; nickname?: string; score: number; rank: number; totalTime: number}>;
}

export interface GameUpdateResponse {
    gameId: string;
    status: "playing" | "finished";
    state: {
        currentQuestionIndex: number;
        totalQuestions: number;
        player: Record<string, PlayerSnapShot>;
        startedAt?: number;
        questionStartedAt?: number;
    };
    lastAnswerUpdate? :{
        playerId: string;
        isCorrect: boolean;
        correctAnswerIndex: number;
        correctText: string;
    };

    nextQuestion?: PublicQuestion | null;
    finalScore?: FinalScore | null; 
}


export interface StartGameResult {
    gameId: string;
    question: PublicQuestion;
}

export interface StartMultiResult extends StartGameResult {
    status: "matched" | "waiting";
    players?: MatchPlayer[];
    roomId?: string;
}

export type MatchPlayer = {
    userId: string;
    nickname: string;
};

export type SetReadyResult = {
    allReady: boolean;
    gameresponse?: GameUpdateResponse;
};

//input
export type StartGameParams = {
   mode: GameMode.SOLO | GameMode.MULTIPLAYER;
   userId: string;
   nickname: string;
   category?: string;
   size?: number;
}