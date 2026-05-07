export type Question = {
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
    totalTime: number;
    isAI: boolean;
}


export enum GameMode {
    SOLO = "solo",
    AI = "ai",
    MULTIPLAYER = "multiplayer",
}
//runtime gamestate to save in redis 
export interface BaseGameState {
    gameId: string;
    mode: GameMode;
    questions: Question[];
    players: Record<string, Player>;
    currentQuestionIndex: number;
    isFinished: boolean;
    startedAt: number;
    roomId?: string; 
}

export interface SoloGameState extends BaseGameState {
    mode: GameMode.SOLO | GameMode.AI
}

export interface MultiGameState extends BaseGameState {
    mode: GameMode.MULTIPLAYER;
    roomId: string;
    hostId: string;
}

export type GameState = SoloGameState | MultiGameState; 

//informations for front 
export interface PLayerSnapShot{
    id: string;
    score: number;
    status: PlayerStatus;
    isAI: boolean;
}

export type FinalScore = {
    winnerId: string;
    finishedAt: number;
    scores: Record<string, number>;
}

export interface GameUpdateResponse {
    gameId: string;
    status: "playing" | "finished";
    state: {
        currentQuestionIndex: number;
        totalQuestions: number;
        player: Record<string, PLayerSnapShot>;
    };
    lastAnswerUpdate? :{
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
export type StartMultiResult extends StartGameResult {
    status: "matched" | "waiting";
    
}