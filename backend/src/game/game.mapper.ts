// src/game/game.mapper.ts
import { 
    BaseGameState,
    GameUpdateResponse, 
    PlayerSnapShot, 
    FinalScore, 
    MatchResult, 
    PublicQuestion 
} from "./game.types";
import { GameMode } from "@prisma/client";

/**
 * @class GameMapper
 * @description transform internal game state into external representations
 * Conversions:
 *
 * Runtime GameState (Redis)
 *      ↓
 * GameUpdateResponse (Frontend DTO)
 *
 * Runtime GameState (Redis)
 *      ↓
 * MatchResult (Database Entity)
 */
export class GameMapper {

    /**
     * @method toUpdateResponse
     * @description convert a runtime game state into a client-facing DTO
     * -create a safe snapshot of the current game state
     * -remove server-only information 
     * -build player summaries
     * -expose the current question
     * -attach answer feedback
     * -generate final score data when the game ends 
     * @param rawState Current runtime state from Redis
     * @param lastAnswerOverride optional answer result associated with the requesting player
     */
    public toUpdateResponse(rawState: BaseGameState, lastAnswerOverride?: any): GameUpdateResponse {
        //create a defensive copy before generation the response
        const state = JSON.parse(JSON.stringify(rawState)) as BaseGameState;

        //convert runtime player objects into lightweight client-facing snapshots
        const playerSnapshots: Record<string, PlayerSnapShot> = {};
        for (const [id, p] of Object.entries(state.players)) {
            playerSnapshots[id] = {
                id: p.id,
                nickname: p.nickname,
                score: p.score,
                status: p.status,
                isAI: p.isAI ?? false,
                totalTime: p.Totaltime // keep casing aligned with the type definition
            };
        }

        //expose the current question 
        let nextQuestion: PublicQuestion | null = null;
        if (!state.isFinished) {
            const currentQ = state.questions[state.currentQuestionIndex];
            if (currentQ) {
                nextQuestion = {
                    id: currentQ.id,
                    question: currentQ.question,
                    options: currentQ.options
                };
            }
        }

        //generate final ranking data once the game finished
        let finalScore: FinalScore | null = null;
        if (state.isFinished) {
            finalScore = this.toFinalScore(state);
        }

        return {
            gameId: state.gameId,
            mode: state.mode as GameMode,
            status: state.isFinished ? "finished" : "playing",
            state: {
                currentQuestionIndex: state.currentQuestionIndex,
                totalQuestions: state.questions.length,
                player: playerSnapshots,
                startedAt: state.startedAt,
                questionStartedAt: state.questionStartedAt,
                // Elapsed time of the current question, computed on the SERVER. It's a
                // duration (not an absolute timestamp the client must compare to its own
                // clock), so a reconnecting client can resume the countdown accurately
                // even if the two machines' clocks differ (remote play).
                questionElapsedMs: Math.max(0, Date.now() - state.questionStartedAt),
            },
            lastAnswerUpdate: lastAnswerOverride ?? null,
            nextQuestion,
            finalScore
        };
    }

    /**
     * @method toGinalScore
     * @description build the final scoreboard 
     * ranking rules: 
     * 1. higer score wins
     * 2. if scores are equal, lower total response time wins
     */
    private toFinalScore(state: BaseGameState): FinalScore {
        //create a score table
        const scores: Record<string, number> = {};
        const playerEntries = Object.values(state.players);

        for (const p of playerEntries) {
            scores[p.id] = p.score;
        }

        // Sort players by:Score descending -> Total response time ascending
        const sortedPlayers = [...playerEntries].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.Totaltime - b.Totaltime;
        });

        //First player in the ranking is considered the winner.
        const winnerId = sortedPlayers[0]?.id ?? "";

        const ranking = sortedPlayers.map((p, index) => ({
            playerId: p.id,
            nickname: p.nickname,
            score: p.score,
            rank: index + 1,
            totalTime: p.Totaltime
        }));

        return {
            winnerId,
            finishedAt: Date.now(),
            scores,
            ranking
        };
    }

    /**
     * @method toMatchResult
     * @description convert a completed game state into a persiste match result entity 
     * The resulting object can be stored
     * in the SQL database through Prisma.
     * @param state 
     * @returns 
     */
    public toMatchResult(state: BaseGameState): MatchResult {
        const playerEntries = Object.values(state.players);

        //calculate final ranking
        const sortedPlayers = [...playerEntries].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.Totaltime - b.Totaltime;
        });

        const winnerId = sortedPlayers[0]?.id;

        const playersMapped = playerEntries.map(p => {
            const rankIndex = sortedPlayers.findIndex(sortedP => sortedP.id === p.id);
            return {
                userId: p.id,
                score: p.score,
                rank: rankIndex !== -1 ? rankIndex + 1 : 1,
                correctAnswers: p.answers.filter(a => a.isCorrect).length,
                totalQuestions: state.questions.length
            };
        });

        return {
            gameId: state.gameId,
            mode: state.mode as GameMode,
            winnerId,
            startedAt: state.startedAt,
            finishedAt: Date.now(),
            players: playersMapped
        };
    }
}
