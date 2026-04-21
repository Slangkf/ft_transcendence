
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

    isAI?: boolean;
    joinOrder?: number; // to get a host for the room 
    lastActiveAt?: Date;

}

export type PublicPlayer = {
    id: string; //playerid
    score: number;
    isAI?: boolean;
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
    startedAt: Date;

}

export type MultiGameState = SoloGameState & {
    mode: "multiplayer";
    roomId: string;
    hostId: string;
    startedAt: Date;
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

//give all info to front with the correct answer
export type GameInfo = {
    gameresult: PublicGameState,
    correctAnswer: string,
    nextQuestion: PublicQuestion | null,
}

//type result to save in database
//export type Result = {
//    gameId: string,
//    mode: "solo" | "IA" | "multiplayer",
//    players: Record<string, PublicPlayer>,
//    
//}

export interface IGameRepository {
    create(game:GameState): Promise<void>;
    findById(gameId: string): Promise<GameState | null>;
    update(game: GameState): Promise<void>;
    delete(gameId: string): Promise<void>;
}

export interface IModeService {
  startGame(userId: string, roomId?: string): Promise<StartGameResult | null>;
  submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): Promise<GameInfo | null>;
  //giveresult(gameId: string) : Promise<Result>;
}
