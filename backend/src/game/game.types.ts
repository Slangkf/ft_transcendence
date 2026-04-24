
//this type maybe need zod to protected, it comes with database
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

export type Player = {
    id: string; //playerid
    score: number;
    answers: PlayerAnswer[];
    status: "online" | "offline" | "playing" | 'answered';
    Totaltime: number;

    isAI?: boolean;
    joinOrder?: number; // to get a host for the room 
    lastActiveAt?: number;
}

export type PublicPlayer = {
    id: string; //playerid
    score: number;
    isAI?: boolean;
}
//type input from front 
export type StartGameParms = {
   mode: "solo" | "multiplayer";
   userId: string;
   nickname: string;
}

export type MatchPlayer = {
    userId: string;
    nickname: string;
};

export type StartMultiResult = {
    status: "waiting" | "matched";
    players?: MatchPlayer[];
    roomId?: string; 
}

export type StartGameResult = {
    gameId: string;
    question: PublicQuestion;
};

export type SoloGameState = {
    gameId: string;
    mode: 'solo' | 'IA' 
    questions: Question[];
    players: Record<string, Player>;
    currentQuestionIndex: number;
    isFinished: boolean;
    startedAt: number;
}

export type MultiGameState = SoloGameState & {
    mode: "multiplayer";
    roomId: string;
    hostId: string;
    startedAt: number;
}
export type GameState = SoloGameState | MultiGameState;

//type for front 
export type PublicGameState = {
  gameId: string;
  players: Record<string, PublicPlayer>;
  currentQuestionIndex: number;
  isFinished: boolean;
  totalQuestions: number;
}

export type FinalScore = {
    gameId: string;
    players: Record<string, PublicPlayer>;
    winner: string; //give the id of winner
    finishedAt: number;
}
//give all info to front with the correct answer
export type PlayingGameInfo = {
    gameresult: PublicGameState,
    correctAnswer: string,
    nextQuestion: PublicQuestion | null,
}

export type FinishedGameInfo = {
    gameresult: PublicGameState;
    finalscore: FinalScore;
}

export type GameInfo = PlayingGameInfo | FinishedGameInfo; 

export interface IGameRepository {
    create(game:GameState): Promise<void>;
    findById(gameId: string): Promise<GameState | null>;
    update(game: GameState): Promise<void>;
    delete(gameId: string): Promise<void>;
}

export interface IModeService {
  startGame(params: StartGameParms): Promise<StartGameResult | null>;
  //submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameInfo | null>;
  //giveresult(gameId: string) : Promise<Result>;
}
