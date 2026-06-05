import { QuestionService } from "src/question/question.service";
import { BaseGameState, FinalScore, GameState, GameUpdateResponse, MatchResult, Player, PlayerSnapShot } from "./game.types";

export class GameMapper {

    constructor(
        private questionService: QuestionService
    ){}

    toUpdateResponse(state: BaseGameState, lastAnswerUpdate?:{
        playerId: string, isCorrect: boolean, correctAnswerIndex: number, correctText: string
    }): GameUpdateResponse{
        const isfinished = state.isFinished;
        const currentQuestion = state.questions[state.currentQuestionIndex];

        return {
            gameId: state.gameId,
            mode: state.mode,
            status: isfinished? "finished" : "playing",
            state: {
                currentQuestionIndex: state.currentQuestionIndex,
                totalQuestions: state.questions.length,
                player:  this.buildPublicPlayerSnapShot(state.players),
                startedAt: state.startedAt,
                questionStartedAt: state.questionStartedAt,
                // Elapsed time of the current question, computed on the SERVER. It's a
                // duration (not an absolute timestamp the client must compare to its own
                // clock), so a reconnecting client can resume the countdown accurately
                // even if the two machines' clocks differ (remote play).
                questionElapsedMs: Math.max(0, Date.now() - state.questionStartedAt),
            },
            nextQuestion: isfinished? null : this.questionService.toPublicQuestion(currentQuestion),
            finalScore: isfinished? this.buildFinalScore(state.players) : null,
            lastAnswerUpdate: lastAnswerUpdate ?? undefined,
        }
    }

    toMatchResult(state: BaseGameState): MatchResult{
        const finalScore = this.buildFinalScore(state.players);
        const players = Object.values(state.players);

        return {
            gameId: state.gameId,
            mode: state.mode,
            winnerId: finalScore.winnerId,
            startedAt: state.startedAt,
            finishedAt: finalScore.finishedAt,
            players: finalScore.ranking.map(({ playerId, score, rank }) => {
            const player = state.players[playerId];
            return {
                userId: playerId,
                score,
                rank,
                correctAnswers: player.answers.filter(a => a.isCorrect).length,
                totalQuestions: state.questions.length,
            };
        }), }
    }

    private buildFinalScore(players: Record<string, Player>): FinalScore{
        const scores = Object.fromEntries(
            Object.entries(players).map(([id, player]: [string, Player]) => [
                id,
                player.score
            ])
        );

        const sorted = Object.entries(players).sort((a, b) => {
            if (b[1].score !== a[1].score) return b[1].score - a[1].score;
            return (a[1].Totaltime || 0) - (b[1].Totaltime || 0);
        });

        const ranking = sorted.map(([playerId, p], index) => ({
            playerId,
            nickname: p.nickname,
            score: p.score,
            rank: index + 1,
            totalTime: p.Totaltime || 0,
        }));

        const winnerId = ranking[0]?.playerId ?? "";
        return {
            winnerId,
            finishedAt: Date.now(),
            scores,
            ranking,
        }
    }

    private buildPublicPlayerSnapShot(players: Record<string, Player>): Record<string, PlayerSnapShot> {
        return Object.fromEntries(
            Object.entries(players).map(([id, player]: [string, Player]) => [
                id,
                {
                    id: player.id,
                    nickname: player.nickname,
                    score: player.score,
                    status: player.status,
                    isAI: player.isAI || false,
                    totalTime: player.Totaltime || 0,
                }
            ])
        )
    }
}