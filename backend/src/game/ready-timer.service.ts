/**
 * Per-room readiness deadline for multiplayer / tournament matches.
 *
 * When players are matched into a room they must all click "Ready" within
 * `timeoutMs`. If they don't, the registered callback is invoked so the caller
 * can resolve the stuck lobby:
 *   - plain multiplayer: abort the match, send everyone back to the menu;
 *   - tournament: the player(s) who never readied forfeit (the ready one wins;
 *     if nobody readied the match has no winner and the bracket collapses to
 *     the other semi-final's result).
 *
 * In-memory only (single node, like QuestionTimerService): a backend restart
 * loses pending deadlines. Armed when the room is created, cancelled when the
 * game actually starts.
 */
export class ReadyTimerService {
    private timers = new Map<string, NodeJS.Timeout>();
    private callback?: (roomId: string) => Promise<void>;

    // Défaut aligné sur la valeur réellement injectée (container.ts) ET sur le
    // compteur "Ready" du front (READY_SECONDS = 60). Évite qu'un oubli d'argument
    // fasse retomber le serveur à 45 s pendant que le client compte encore 60 s.
    constructor(public readonly timeoutMs: number = 60_000) {}

    setTimeoutCallback(cb: (roomId: string) => Promise<void>) {
        this.callback = cb;
    }

    /** Arm (or re-arm) the readiness deadline for a room. */
    arm(roomId: string): void {
        this.cancel(roomId);
        const timer = setTimeout(() => {
            this.timers.delete(roomId);
            this.callback?.(roomId).catch(e => console.error('ReadyTimerService fire error', e));
        }, this.timeoutMs);
        this.timers.set(roomId, timer);
    }

    /** Cancel the deadline (e.g. once the game has started). No-op if none. */
    cancel(roomId: string): void {
        const existing = this.timers.get(roomId);
        if (existing) {
            clearTimeout(existing);
            this.timers.delete(roomId);
        }
    }
}
