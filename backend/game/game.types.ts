export type Question = {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number;
};

export type PublicQuestion = {
  id: number;
  question: string;
  options: string[];
};

export type GameState = {
  id: string;
  currentQuestionIndex: number;
  score: number;
  isFinished: boolean;
};

export type StartGameResult = {
  gameId: string;
  question: PublicQuestion;
};

export type AnswerResult = {
  isCorrect: boolean;
  correctAnswer: string;
  nextQuestion: PublicQuestion | null;
  score: number;
  isFinished: boolean;
};

export interface IModeService {
  startGame(): Promise<StartGameResult | null>;
  submitAnswer(gameId: string, selectedAnswerIndex: number): AnswerResult | null;
}
