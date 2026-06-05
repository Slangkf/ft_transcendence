import { RedisGameRepository } from "./game.redis.repository";
import { GameState } from "./game.types";

export type PostAnswerOptions = {
    lastAnswerUpdate?: {
        playerId: string;
        isCorrect: boolean;
        correctAnswerIndex: number;
        correctText: string;
    };
    timedOut?: boolean;
};

export type ForceAdvanceCallback = (state: GameState, opts?: PostAnswerOptions) => Promise<void>;

/**
 * Per-question server-side deadline for multi/tournament games.
 * If no answer lands within `timeoutMs`, the current question is closed
 * forcibly: any player who hasn't answered gets a wrong answer recorded,
 * the game advances, and the registered callback is invoked so the caller
 * can broadcast the new state / finalize.
 *
 * In-memory only — a backend restart loses pending timers. Acceptable for
 * a single-node setup. Reschedule on every successful advance to keep the
 * deadline aligned with `questionStartedAt`.
 */
export class QuestionTimerService {
    private timers = new Map<string, { timer: NodeJS.Timeout; qIndex: number }>();
    private callback?: ForceAdvanceCallback;

    constructor(
        private gameRepo: RedisGameRepository,
        public readonly timeoutMs: number = 30_000,
    ) {}

    setAdvanceCallback(cb: ForceAdvanceCallback) {
        this.callback = cb;
    }

    /**
     * Arm the timeout for the current question of `gameId`. Idempotent: if a
     * timer is already armed for the same question, no-op (so a partial answer
     * can't reset the deadline). Replaces the timer when the question has
     * advanced.
     */
    async schedule(gameId: string): Promise<void> {
        const state = await this.gameRepo.findById(gameId);
        if (!state || state.isFinished) return;
        if (state.mode !== 'MULTIPLAYER' && state.mode !== 'TOURNAMENT') return;
        const qIndex = state.currentQuestionIndex;
        const existing = this.timers.get(gameId);
        if (existing && existing.qIndex === qIndex) return;
        if (existing) clearTimeout(existing.timer);
        // Slack so the SERVER never closes a question before the client's visual
        // countdown reaches 0. The client only starts the next question's countdown
        // AFTER its ~1.5s answer-reveal animation (REVEAL_DELAY_MS), so it lags the
        // server's schedule by that much — cover the reveal delay + network margin.
        const timer = setTimeout(() => this.fire(gameId, qIndex), this.timeoutMs + 2000);
        this.timers.set(gameId, { timer, qIndex });
    }

    cancel(gameId: string): void {
        const existing = this.timers.get(gameId);
        if (existing) {
            clearTimeout(existing.timer);
            this.timers.delete(gameId);
        }
    }

    private async fire(gameId: string, expectedQIndex: number): Promise<void> {
        this.timers.delete(gameId);
        try {
            // peek the timed-out question BEFORE the force-advance bumps the index,
            // so the broadcast can still tell clients which answer was correct
            const before = await this.gameRepo.findById(gameId);
            const oldQ = before?.questions?.[expectedQIndex];
            const newState = await this.gameRepo.forceAdvanceOnTimeout(gameId, expectedQIndex);
            if (!newState) return;
            const lastAnswerUpdate = oldQ ? {
                playerId: '__timeout__',
                isCorrect: false,
                correctAnswerIndex: oldQ.correctAnswerIndex,
                correctText: oldQ.options?.[oldQ.correctAnswerIndex] ?? '',
            } : undefined;
            if (this.callback) await this.callback(newState, { lastAnswerUpdate, timedOut: true });
        } catch (e) {
            console.error('QuestionTimerService fire error', e);
        }
    }
}
