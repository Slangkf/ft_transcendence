<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getGameSocket, disconnectGameSocket, ensureGameSocketConnected } from '$lib/shared/gameSocket';

  type PublicQuestion = { id: number; question: string; options: string[] };
  type PlayerSnapshot = { id: string; score: number; status: string; isAI: boolean; nickname?: string };
  type FinalScore = {
    winnerId: string;
    finishedAt: number;
    scores: Record<string, number>;
    ranking: Array<{ playerId: string; nickname?: string; score: number; rank: number; totalTime: number }>;
  };
  type AnswerResultPayload = {
    gameId: string;
    status: 'playing' | 'finished';
    totalQuestions?: number;
    currentQuestionIndex?: number;
    lastAnswerUpdate?: {
      playerId: string;
      isCorrect: boolean;
      correctAnswerIndex: number;
      correctText: string;
    };
    timedOut?: boolean;
    nextQuestion?: PublicQuestion | null;
    players: Record<string, PlayerSnapshot>;
    finalScore?: FinalScore | null;
  };
  type ReconnectPayload =
    | { type: 'idle' }
    | { type: 'queue'; message: string }
    | { type: 'matched'; roomId: string; players: any[] }
    | { type: 'in_room'; roomId: string; players: any[]; roomStatus: string }
    | { type: 'in_game'; gameId: string; state: any };

  const REVEAL_DELAY_MS = 1500;
  const QUESTION_TIMEOUT_MS = 30_000;
  const gameId = $derived(page.params.gameId);

  let currentQuestion = $state<PublicQuestion | null>(null);
  let questionNumber = $state(1);
  let totalQuestions = $state(0);
  let playersState = $state<PlayerSnapshot[]>([]);
  let isFinished = $state(false);
  let finalScore = $state<FinalScore | null>(null);
  let feedback = $state('');
  let error = $state('');
  let selectedIndex = $state<number | null>(null);
  let correctIndex = $state<number | null>(null);
  let startedAt = $state<number | null>(null);
  let questionStartedAt = $state<number | null>(null);
  let now = $state(Date.now());
  let tickHandle: ReturnType<typeof setInterval> | null = null;
  // Resync watchdog: detects a game stuck with no question (a raced/lost event) and
  // forces ONE reconnect to pull fresh server state — the automated equivalent of the
  // manual refresh the user had to do.
  let stuckSince: number | null = null;
  let resyncing = false;
  // tournament games auto-redirect to the bracket on finish, so they don't need
  // the "back to menu" button on the results screen — plain multiplayer does.
  let inTournamentGame = $state(false);

  const elapsedMs = $derived(startedAt ? Math.max(0, now - startedAt) : 0);
  function formatTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }

  const nameOf = (id: string) => playersState.find(p => String(p.id) === String(id))?.nickname ?? id;
  let revealing = $state(false);
  let answered = $state(false);
  // An answer the user picked but the server hasn't confirmed yet. On remote churn
  // the emit can be lost with a dying socket; we re-send it on reconnect so a present,
  // answering player is never scored 0 by the question timer. Keyed by questionId.
  let pendingAnswer: { questionId: number; answerIndex: number } | null = null;

  const secondsLeft = $derived(
    questionStartedAt && !revealing && !answered && !isFinished
      ? Math.max(0, Math.ceil((QUESTION_TIMEOUT_MS - (now - questionStartedAt)) / 1000))
      : null
  );

  function resetReveal() {
    selectedIndex = null;
    correctIndex = null;
    revealing = false;
    answered = false;
    pendingAnswer = null;
  }

  let backToBracketHandle: ReturnType<typeof setTimeout> | null = null;
  function maybeReturnToBracket(explicitTid?: string) {
    let tid: string | null = explicitTid ?? null;
    if (!tid) { try { tid = sessionStorage.getItem('current_tournament_id'); } catch {} }
    if (!tid) { console.log(`[JUMP-CLI] play maybeReturnToBracket: no tournament id -> staying on results (plain MP)`); return; }
    if (backToBracketHandle) { console.log(`[JUMP-CLI] play maybeReturnToBracket: already scheduled`); return; }
    console.log(`[JUMP-CLI] play maybeReturnToBracket -> goto bracket ${tid.slice(0, 8)} in 4s (game=${gameId?.slice(0, 8)})`);
    backToBracketHandle = setTimeout(() => {
      console.log(`[JUMP-CLI] play maybeReturnToBracket FIRING -> goto /game/tournament/${tid!.slice(0, 8)}`);
      goto(`/game/tournament/${tid}`);
    }, 4000);
  }

  function buttonClasses(index: number): string {
    const base = 'w-full text-left px-4 py-3 rounded border transition disabled:cursor-not-allowed';
    if (revealing) {
      if (index === correctIndex) return `${base} bg-green-500/40 border-green-300/60 text-white`;
      if (index === selectedIndex) return `${base} bg-red-500/40 border-red-300/60 text-white`;
      return `${base} bg-gray-500/15 border-white/10 text-blue-100/60`;
    }
    if (answered) {
      if (index === selectedIndex) return `${base} bg-blue-500/40 border-blue-300/60 text-white`;
      return `${base} bg-gray-500/15 border-white/10 text-blue-100/60`;
    }
    return `${base} bg-gray-500/25 hover:bg-gray-400/35 border-white/20 text-blue-100`;
  }

  function transitionToFinished() {
    console.log(`[JUMP-CLI] play transitionToFinished game=${gameId?.slice(0, 8)} winner=${finalScore?.winnerId ?? '-'} inTournament=${inTournamentGame}`);
    revealing = false;
    answered = false;
    isFinished = true;
    currentQuestion = null;
    questionStartedAt = null;
    feedback = '';
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
    maybeReturnToBracket();
  }

  function applyAnswerResult(info: AnswerResultPayload) {
    const correctText = info.lastAnswerUpdate?.correctText;

    // A round is only "resolved" once every player has answered (correctText is
    // set), the question timed out, or the game finished. Until then this is just
    // a partial submit (we answered, others haven't): don't touch the scoreboard,
    // otherwise our own score visibly ticks up before the correct/incorrect reveal.
    const roundResolved = !!correctText || !!info.timedOut || info.status === 'finished';
    if (!roundResolved) return;

    // reveal time: now it's safe to surface the updated scores
    playersState = Object.values(info.players);
    if (typeof info.totalQuestions === 'number' && info.totalQuestions > 0) {
      totalQuestions = info.totalQuestions;
    }

    if (info.status === 'finished') {
      finalScore = info.finalScore ?? null;
      // reveal the last answer first (same delay as other questions) before showing the end screen
      const canReveal = !!currentQuestion && (!!correctText || info.timedOut);
      if (canReveal) {
        correctIndex = info.lastAnswerUpdate?.correctAnswerIndex ?? null;
        revealing = true;
        if (info.timedOut) {
          feedback = correctText
            ? `Time's up! The correct answer was: ${correctText}`
            : `Time's up!`;
        } else {
          feedback = selectedIndex === null
            ? `Correct answer: ${correctText}`
            : (selectedIndex === correctIndex ? 'Correct answer.' : `Wrong answer. The correct answer was: ${correctText}`);
        }
        setTimeout(transitionToFinished, REVEAL_DELAY_MS);
      } else {
        transitionToFinished();
      }
      return;
    }

    if (currentQuestion) {
      correctIndex = info.lastAnswerUpdate?.correctAnswerIndex ?? null;
      revealing = true;
      if (info.timedOut) {
        feedback = correctText
          ? `Time's up! The correct answer was: ${correctText}`
          : `Time's up!`;
      } else {
        feedback = selectedIndex === null
          ? `Correct answer: ${correctText}`
          : (selectedIndex === correctIndex ? 'Correct answer.' : `Wrong answer. The correct answer was: ${correctText}`);
      }
    }

    // Capture this result's next question in a LOCAL const, never a shared field.
    // In a fast semi-final two rounds can resolve within REVEAL_DELAY_MS, scheduling
    // two reveal timers. The old code read a SHARED `pendingNext` at fire-time: the
    // first timer consumed it and set it null, so the second timer set currentQuestion
    // to null → the game froze on the scoreboard until a manual refresh. A per-result
    // capture lets each timer restore its own question and never nulls it mid-game.
    const nextQ = info.nextQuestion ?? null;
    // Server-authoritative counter (the server already advanced its index).
    const serverNextNumber =
      typeof info.currentQuestionIndex === 'number' ? info.currentQuestionIndex + 1 : null;
    setTimeout(() => {
      currentQuestion = nextQ;
      if (currentQuestion) {
        questionNumber = serverNextNumber ?? questionNumber + 1;
        questionStartedAt = Date.now();
      } else {
        questionStartedAt = null;
      }
      feedback = '';
      resetReveal();
    }, REVEAL_DELAY_MS);
  }

  // Re-send an unconfirmed answer after a reconnect. Safe: the server ignores it if
  // the question already advanced (expectedQuestionId mismatch) or it was already
  // recorded (idempotent per question). Without this, an answer emitted on a socket
  // that dies during remote churn is silently lost and the question timer scores 0.
  function flushPendingAnswer() {
    if (!pendingAnswer) return;
    if (!currentQuestion || currentQuestion.id !== pendingAnswer.questionId) {
      pendingAnswer = null;
      return;
    }
    const socket = getGameSocket();
    socket.emit('submit_answer',
      { gameId, selectedAnswerIndex: pendingAnswer.answerIndex, questionId: pendingAnswer.questionId },
      (ack: any) => { if (ack?.success) pendingAnswer = null; });
  }
  function onSocketConnect() { flushPendingAnswer(); }

  function setupSocket() {
    const socket = getGameSocket();

    socket.off('answer_result');
    socket.off('session_reconnect');
    socket.off('tournament_finished');
    socket.off('error');
    socket.off('connect', onSocketConnect);
    socket.on('connect', onSocketConnect);

    // Finalists are on this page when the tournament ends; bring them back to the
    // bracket so they see the final "Tournament over" ranking (not just their
    // own match result). Robust even if the game_finished redirect timing slips.
    socket.on('tournament_finished', (payload: { tournamentId: string }) => {
      console.log(`[JUMP-CLI] play got tournament_finished t=${payload.tournamentId?.slice(0, 8)} -> return to bracket`);
      maybeReturnToBracket(payload.tournamentId);
    });

    socket.on('answer_result', (info: AnswerResultPayload) => {
      // IGNORE another game's events. The /game socket is a persistent singleton
      // joined to the tournament room AND to the match room; a player can therefore
      // receive an event meant for a DIFFERENT match (e.g. the other semi-final, or
      // a residual event from a previous game in the same tab). Without this guard a
      // foreign `answer_result`/`game_finished` would wrongly drive THIS page —
      // notably flipping it to "finished".
      if (info.gameId !== gameId) return;
      applyAnswerResult(info);
    });

    socket.off('game_finished');
    socket.on('game_finished', (payload: { gameId: string; state: any }) => {
      if (payload.gameId !== gameId) {
        console.log(`[JUMP-CLI] play got game_finished for OTHER game=${payload.gameId?.slice(0, 8)} (mine=${gameId?.slice(0, 8)}) -> IGNORED`);
        return;
      }
      console.log(`[JUMP-CLI] play got game_finished game=${payload.gameId?.slice(0, 8)} revealing=${revealing} hasQ=${!!currentQuestion}${revealing && currentQuestion ? ' -> let reveal timer finish' : ' -> transitionToFinished now'}`);
      finalScore = payload?.state?.finalScore ?? finalScore;
      if (payload?.state?.state?.player) {
        playersState = Object.values(payload.state.state.player);
      }
      // if the answer_result for the last question already kicked off a reveal,
      // let its timer perform the transition so the green/red feedback stays visible
      if (revealing && currentQuestion) return;
      transitionToFinished();
    });

    socket.on('session_reconnect', (payload: ReconnectPayload) => {
      console.log(`[JUMP-CLI] play got session_reconnect type=${payload.type}${payload.type === 'in_game' ? ` game=${(payload as any).gameId?.slice(0, 8)} finished=${(payload as any).state?.status === 'finished'}` : ''} (mine=${gameId?.slice(0, 8)})`);
      if (payload.type === 'in_game') {
        // Same guard as above: a request_sync/reconnect replays the session's
        // CURRENT game. If that isn't the game this page is showing, ignore it.
        if (payload.gameId !== gameId) { console.log(`[JUMP-CLI] play session_reconnect in_game for OTHER game -> IGNORED`); return; }
        const state = payload.state;
        totalQuestions = state.state?.totalQuestions ?? 0;
        playersState = Object.values(state.state?.player ?? {});
        questionNumber = (state.state?.currentQuestionIndex ?? 0) + 1;
        isFinished = state.status === 'finished';
        // Resume the countdown from the SERVER-computed elapsed (a clock-skew-free
        // duration) instead of the server's absolute questionStartedAt — otherwise a
        // clock difference between the two machines throws the timer off on reconnect.
        if (!startedAt) startedAt = Date.now();
        const elapsed = state.state?.questionElapsedMs ?? 0;
        questionStartedAt = Date.now() - elapsed;
        if (isFinished) {
          finalScore = state.finalScore ?? finalScore;
          if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
        }
        // Restore the current question from the server. If the server has moved on to
        // a DIFFERENT question than the one we were showing, this is a fresh question:
        // wipe any leftover answer state, otherwise the new question appears already
        // answered (old option highlighted, buttons disabled) — an "automatic answer"
        // the user never gave, which also locks them out of answering. If it's the SAME
        // question we already answered, keep `answered` so the buttons stay locked (no
        // double answer). This matters because a resync (reconnect / focus-return
        // request_sync / watchdog) can land across a question boundary.
        let restoredQ: PublicQuestion | null = null;
        try { restoredQ = state.nextQuestion ?? null; } catch { restoredQ = null; }
        const sameQuestion = restoredQ?.id != null && restoredQ.id === currentQuestion?.id;
        currentQuestion = restoredQ;
        if (!sameQuestion) {
          resetReveal();   // selectedIndex/correctIndex/revealing/answered/pendingAnswer
          feedback = '';
        }
      }
    });

    socket.on('error', (payload: { message: string }) => {
      error = payload.message ?? 'Socket error';
    });
  }

  function loadInitialQuestion() {
    try {
      const raw = sessionStorage.getItem('mp_first_question');
      if (raw) {
        sessionStorage.removeItem('mp_first_question');
        const payload = JSON.parse(raw);
        // Ignore a stale hint left over from a different game (defense against
        // loading a previous game's first question / state into this one).
        if (payload.gameId && payload.gameId !== gameId) return;
        currentQuestion = payload.question;
        questionNumber = 1;
        if (typeof payload.totalQuestions === 'number' && payload.totalQuestions > 0) {
          totalQuestions = payload.totalQuestions;
        }
        // Anchor the countdown on the CLIENT clock. The question just started, and
        // using the server's absolute `startedAt` breaks the timer between machines
        // whose clocks aren't synced (remote play): the countdown would be off by the
        // clock skew — e.g. still show 15s while the server already hit 0 and auto-
        // closed the question. Local time keeps the countdown machine-independent.
        startedAt = Date.now();
        questionStartedAt = Date.now();
      }
    } catch {}
  }

  async function submitAnswer(answerIndex: number) {
    if (!currentQuestion || answered || revealing || isFinished) return;
    selectedIndex = answerIndex;
    answered = true;
    // Capture the choice first so a reconnect can re-send it if this emit is lost
    // with a dying socket (remote churn). The questionId guards against ever
    // applying it to a different question.
    pendingAnswer = { questionId: currentQuestion.id, answerIndex };
    try {
      await ensureGameSocketConnected();
    } catch (err) {
      // Socket down: keep the captured answer and the locked-in UI. onSocketConnect
      // flushes it on reconnect — don't score a present player 0 for a blip.
      return;
    }
    const socket = getGameSocket();
    socket.emit('submit_answer', { gameId, selectedAnswerIndex: answerIndex, questionId: currentQuestion.id }, (ack: any) => {
      if (ack?.success) {
        pendingAnswer = null;
      } else if (ack && ack.success === false) {
        // server explicitly rejected (not merely a lost socket) — let the user retry
        pendingAnswer = null;
        answered = false;
        error = ack?.message ?? 'Failed to submit answer.';
      }
    });
  }

  onMount(() => {
    try { inTournamentGame = !!sessionStorage.getItem('current_tournament_id'); } catch {}
    console.log(`[JUMP-CLI] play page MOUNT game=${gameId?.slice(0, 8)} inTournament=${inTournamentGame}`);
    setupSocket();
    loadInitialQuestion();
    // Pull the authoritative current state from the server. The socket persists across
    // navigation, so there's no reconnect to trigger session_reconnect automatically;
    // request_sync makes the server replay it (current question, scores, status). This
    // is what guarantees the question shows even if the sessionStorage hint was missed.
    const socket = getGameSocket();
    if (!socket.active) socket.connect();
    socket.emit('request_sync');
    if (!startedAt) startedAt = Date.now();
    tickHandle = setInterval(() => {
      now = Date.now();
      // Watchdog: if the game is running but we have no question to show (and we're
      // not mid-reveal), an event was raced/lost. Re-pull the authoritative state from
      // the server (request_sync → session_reconnect) instead of leaving the player
      // frozen on the scoreboard waiting for a manual refresh. Cheap and non-disruptive.
      if (!isFinished && currentQuestion === null && !revealing) {
        if (stuckSince === null) stuckSince = now;
        else if (!resyncing && now - stuckSince > 3000) {
          resyncing = true;
          try { getGameSocket().emit('request_sync'); } catch {}
          setTimeout(() => { resyncing = false; stuckSince = null; }, 2000);
        }
      } else {
        stuckSince = null;
      }
    }, 250);
  });

  onDestroy(() => {
    if (tickHandle) clearInterval(tickHandle);
    if (backToBracketHandle) clearTimeout(backToBracketHandle);
    // Remove every handler this page put on the SHARED singleton socket. The socket
    // outlives the page (no-op disconnect across navigation), so handlers left behind
    // keep firing on the next page — a leaked, unfiltered handler from a finished game
    // is exactly what could end an unrelated match. Tear them all down here.
    try {
      const s = getGameSocket();
      s.off('connect', onSocketConnect);
      s.off('answer_result');
      s.off('game_finished');
      s.off('session_reconnect');
      s.off('tournament_finished');
      s.off('error');
    } catch {}
    // if we are in a tournament, keep the socket alive across navigation
    let inTournament = false;
    try { inTournament = !!sessionStorage.getItem('current_tournament_id'); } catch {}
    if (!inTournament) disconnectGameSocket();
  });
</script>

<svelte:head>
  <title>{inTournamentGame ? 'Tournament Game' : 'Multiplayer Game'}</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">
  <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-2">
    {inTournamentGame ? 'Tournament Quiz' : 'Multiplayer Quiz'}
  </h1>
  <p class="text-center text-blue-100/80 text-sm mb-4">
    Time: <span class="font-mono text-pink-200">{formatTime(elapsedMs)}</span>
  </p>

  <div class="grid gap-2 mb-4">
    {#each playersState as p}
      <div class="flex items-center justify-between px-3 py-2 rounded bg-gray-500/20 border border-white/10">
        <span class="text-blue-100 text-sm">{p.nickname ?? p.id}</span>
        <span class="text-pink-200 font-bold">{p.score}</span>
      </div>
    {/each}
  </div>

  {#if error}
    <div class="mb-4 rounded bg-red-500/20 border border-red-300/30 px-4 py-3 text-red-100">
      {error}
    </div>
  {/if}

  {#if feedback}
    <div class="mb-4 rounded bg-white/10 border border-white/20 px-4 py-3 text-blue-100">
      {feedback}
    </div>
  {/if}

  {#if currentQuestion && !isFinished}
    <section class="mt-6">
      <p class="text-center text-sm text-blue-100/80 mb-2">
        Question {questionNumber}{#if totalQuestions > 0} / {totalQuestions}{/if}
      </p>
      {#if secondsLeft !== null}
        <p class="text-center mb-2">
          <span class="inline-block font-mono text-lg font-bold
            {secondsLeft <= 5 ? 'text-red-300 animate-pulse' : secondsLeft <= 10 ? 'text-yellow-200' : 'text-blue-100/80'}">
            ⏱ {secondsLeft}s
          </span>
        </p>
      {/if}
      <h2 class="text-base sm:text-xl md:text-2xl font-semibold text-pink-200 p-4 text-center">
        {currentQuestion.question}
      </h2>
      <div class="grid gap-3 p-4">
        {#each currentQuestion.options as option, index}
          <button
            type="button"
            onclick={() => submitAnswer(index)}
            disabled={answered || revealing}
            class={buttonClasses(index)}
          >
            {option}
          </button>
        {/each}
      </div>
      {#if answered && !revealing}
        <p class="text-center text-blue-100/70 text-sm">Waiting for other players...</p>
      {/if}
    </section>
  {/if}

  {#if isFinished && finalScore}
    <section class="mt-6">
      <h2 class="text-base sm:text-xl md:text-2xl font-semibold text-pink-200 p-4 text-center">
        Game finished
      </h2>
      <p class="text-center text-blue-100 mb-4">Winner: <span class="font-bold text-pink-200">{finalScore.ranking.find(r => String(r.playerId) === String(finalScore!.winnerId))?.nickname ?? nameOf(finalScore.winnerId)}</span></p>
      <div class="grid gap-2">
        {#each finalScore.ranking as entry}
          <div class="flex items-center justify-between px-3 py-2 rounded bg-gray-500/20 border border-white/10">
            <span class="text-blue-100">#{entry.rank} {entry.nickname ?? nameOf(entry.playerId)}</span>
            <span class="text-pink-200 font-bold">
              {entry.score} / {totalQuestions}
              <span class="text-blue-100/70 font-mono text-sm ml-2">{formatTime(entry.totalTime ?? 0)}</span>
            </span>
          </div>
        {/each}
      </div>

      {#if inTournamentGame}
        <p class="text-center text-blue-100/70 text-sm mt-6">Back to the tournament…</p>
      {:else}
        <div class="flex justify-center gap-4 mt-6">
          <a href="/modes" class="px-6 py-3 rounded bg-white/20 hover:bg-white/30 border border-white/20 text-blue-100 font-semibold transition">
            Back to menu
          </a>
          <a href="/game/multiplayer" class="px-6 py-3 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-blue-100/80 transition">
            Play again
          </a>
        </div>
      {/if}
    </section>
  {/if}
</div>
