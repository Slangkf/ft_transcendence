import { z } from 'zod';

// Backend: Database schema for Question
export const QuestionSchema = z.object({
    id: z.number(),
    question: z.string(),
    options: z.array(z.string()),
    correctAnswerIndex: z.number(),
});
export type Question = z.infer<typeof QuestionSchema>;

// Frontend: Public question schema (without correct answer)
export const PublicQuestionSchema = z.object({
    id: z.number(),
    question: z.string(),
    options: z.array(z.string()),
});
export type PublicQuestion = z.infer<typeof PublicQuestionSchema>;

// Backend: Player schema
export const PlayerSchema = z.object({
    id: z.string(),
    score: z.number(),
    answers: z.array(z.object({
        questionId: z.number(),
        selectedAnswerIndex: z.number(),
        isCorrect: z.boolean(),
        answeredAt: z.number().optional(),
    })),
    status: z.enum(['online', 'offline', 'playing', 'answered']),
    Totaltime: z.number(),
    isAI: z.boolean().optional(),
    joinOrder: z.number().optional(),
    lastActiveAt: z.number().optional(),
});
export type Player = z.infer<typeof PlayerSchema>;

// Frontend: Public player schema
export const PublicPlayerSchema = z.object({
    id: z.string(),
    score: z.number(),
    isAI: z.boolean().optional(),
});
export type PublicPlayer = z.infer<typeof PublicPlayerSchema>;

// Backend: Game state schema
export const GameStateSchema = z.discriminatedUnion('mode', [
    z.object({
        gameId: z.string(),
        mode: z.literal('solo'),
        questions: z.array(QuestionSchema),
        players: z.record(z.string(), PlayerSchema),
        currentQuestionIndex: z.number(),
        isFinished: z.boolean(),
        startedAt: z.number(),
    }),
    z.object({
        gameId: z.string(),
        mode: z.literal('multiplayer'),
        questions: z.array(QuestionSchema),
        players: z.record(z.string(), PlayerSchema),
        currentQuestionIndex: z.number(),
        isFinished: z.boolean(),
        startedAt: z.number(),
        roomId: z.string(),
        hostId: z.string(),
    }),
]);
export type GameState = z.infer<typeof GameStateSchema>;

// Frontend: Public game state schema
export const PublicGameStateSchema = z.object({
    gameId: z.string(),
    players: z.record(z.string(), PublicPlayerSchema),
    currentQuestionIndex: z.number(),
    isFinished: z.boolean(),
    totalQuestions: z.number(),
});
export type PublicGameState = z.infer<typeof PublicGameStateSchema>;

// Backend: Start game parameters
export const StartGameParmsSchema = z.object({
    mode: z.enum(['solo', 'ai','multi']),
    userId: z.string(),
    nickname: z.string(),
});
export type StartGameParms = z.infer<typeof StartGameParmsSchema>;

// Backend/Frontend: Start game result
export const StartGameResultSchema = z.object({
    gameId: z.string(),
    question: PublicQuestionSchema,
});
export type StartGameResult = z.infer<typeof StartGameResultSchema>;

export type MatchPlayer = {
    userId: string;
    nickname: string;
};

export type PlayerSnapShot = {
    id: string;
    nickname?: string;
    score: number;
    status: 'playing' | 'answered' | 'disconnected';
    isAI: boolean;
};

export type FinalScore = {
    winnerId: string;
    finishedAt: number;
    scores: Record<string, number>;
    ranking: Array<{playerId: string; score: number; rank: number}>;
};

export interface GameUpdateResponse {
    gameId: string;
    status: 'playing' | 'finished';
    state: {
        currentQuestionIndex: number;
        totalQuestions: number;
        player: Record<string, PlayerSnapShot>;
    };
    lastAnswerUpdate?: {
        playerId: string;
        isCorrect: boolean;
        correctAnswerIndex: number;
        correctText: string;
    };
    nextQuestion?: PublicQuestion | null;
    finalScore?: FinalScore | null;
}

// Backend/Frontend: Game info union
export const PlayingGameInfoSchema = z.object({
    gameresult: PublicGameStateSchema,
    correctAnswer: z.string(),
    nextQuestion: PublicQuestionSchema.nullable(),
});

export const FinishedGameInfoSchema = z.object({
    gameresult: PublicGameStateSchema,
    finalscore: z.object({
        gameId: z.string(),
        players: z.record(z.string(), PublicPlayerSchema),
        winner: z.string(),
        finishedAt: z.number(),
    }),
});

export const GameInfoSchema = z.union([PlayingGameInfoSchema, FinishedGameInfoSchema]);
export type GameInfo = z.infer<typeof GameInfoSchema>;


export const SubmitAnswerReqSchema = z.object({
    selectedAnswerIndex: z.coerce.number().min(0),
    mode: z.enum(['solo', 'ai','multiplayer', 'tournament']),
    gameId: z.string().min(1),
})
export type SubmitAnswerReq = z.infer<typeof SubmitAnswerReqSchema>;

export const StartGameReq = z.object({
    mode: z.enum(['solo', 'ai','multiplayer', 'tournament']),
    category: z.string().trim().min(1).optional(),
    size: z.coerce.number().int().positive().optional(),
})

export const SetReadyParams = z.object({
    mode: z.enum(['solo', 'ai', 'multiplayer', 'tournament']),
    roomId: z.string().min(1),
    isReady: z.boolean(),
})

