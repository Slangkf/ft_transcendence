
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
}

export type Player = {
    id: string; //playerid
    score: number;
    answers: PlayerAnswer[];
}

export type StartGameResult = {
  gameId: string;
  question: PublicQuestion;
};

export type GameState = {
    gameId: string;
    questions: Question[];
    players: Player[];
    currentQuestionIndex: number;
    isFinished: boolean;
}

//give all info to front with the correct answer
export type GameInfo = {
    gameresult: GameState,
    correctAnswer: string,
    nextQuestion: PublicQuestion | null,
}

export interface IGameRepository {
    create(game:GameState): Promise<void>;
    findById(gameId: string): Promise<GameState | null>;
    update(game: GameState): Promise<void>;
    delete(gameId: string): Promise<void>;
}
export interface IModeService {
  startGame(userId: string): Promise<StartGameResult | null>;
  submitAnswer(gameId: string, selectedAnswerIndex: number, userId: string): AnswerResult | null;
}