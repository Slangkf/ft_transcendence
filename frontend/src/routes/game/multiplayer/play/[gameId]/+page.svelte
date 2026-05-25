<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { getGameSocket, disconnectGameSocket, ensureGameSocketConnected } from '$lib/shared/gameSocket';

  type PublicQuestion = { id: number; question: string; options: string[] };
  type PlayerSnapshot = { id: string; score: number; status: string; isAI: boolean; nickname?: string };
  type FinalScore = {
    winnerId: string;
    finishedAt: number;
    scores: Record<string, number>;
    ranking: Array<{ playerId: string; score: number; rank: number }>;
  };
  type AnswerResultPayload = {
    gameId: string;
    status: 'playing' | 'finished';
    lastAnswerUpdate: {
      playerId: string;
      isCorrect: boolean;
      correctAnswerIndex: number;
      correctText: string;
    };
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
  const gameId = $derived(page.params.gameId);

  let currentQuestion = $state<PublicQuestion | null>(null);
  let pendingNext = $state<PublicQuestion | null>(null);
  let questionNumber = $state(1);
  let totalQuestions = $state(0);
  let playersState = $state<PlayerSnapshot[]>([]);
  let isFinished = $state(false);
  let finalScore = $state<FinalScore | null>(null);
  let feedback = $state('');
  let error = $state('');
  let selectedIndex = $state<number | null>(null);
  let correctIndex = $state<number | null>(null);

  const nameOf = (id: string) => playersState.find(p => p.id === id)?.nickname ?? id;
  let revealing = $state(false);
  let answered = $state(false);

  function resetReveal() {
    selectedIndex = null;
    correctIndex = null;
    revealing = false;
    answered = false;
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

  function applyAnswerResult(info: AnswerResultPayload) {
    playersState = Object.values(info.players);

    if (info.status === 'finished') {
      revealing = false;
      answered = false;
      isFinished = true;
      finalScore = info.finalScore ?? null;
      currentQuestion = null;
      feedback = '';
      return;
    }

    const correctText = info.lastAnswerUpdate?.correctText;
    if (!correctText) return; // round not yet complete (partial submit)

    if (currentQuestion) {
      correctIndex = info.lastAnswerUpdate.correctAnswerIndex;
      revealing = true;
      feedback = selectedIndex === null
        ? `Correct answer: ${correctText}`
        : (selectedIndex === correctIndex ? 'Correct answer.' : `Wrong answer. Correct answer: ${correctText}`);
    }

    pendingNext = info.nextQuestion ?? null;
    setTimeout(() => {
      currentQuestion = pendingNext;
      pendingNext = null;
      if (currentQuestion) questionNumber += 1;
      feedback = '';
      resetReveal();
    }, REVEAL_DELAY_MS);
  }

  function setupSocket() {
    const socket = getGameSocket();

    socket.off('answer_result');
    socket.off('session_reconnect');
    socket.off('error');

    socket.on('answer_result', (info: AnswerResultPayload) => {
      applyAnswerResult(info);
    });

    socket.on('session_reconnect', (payload: ReconnectPayload) => {
      if (payload.type === 'in_game') {
        const state = payload.state;
        totalQuestions = state.state?.totalQuestions ?? 0;
        playersState = Object.values(state.state?.player ?? {});
        questionNumber = (state.state?.currentQuestionIndex ?? 0) + 1;
        isFinished = state.status === 'finished';
        // restore current question from server-provided nextQuestion
        try { currentQuestion = state.nextQuestion ?? null; } catch { currentQuestion = null; }
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
        const payload = JSON.parse(raw);
        currentQuestion = payload.question;
        questionNumber = 1;
        sessionStorage.removeItem('mp_first_question');
      }
    } catch {}
  }

  async function submitAnswer(answerIndex: number) {
    if (!currentQuestion || answered || revealing || isFinished) return;
    selectedIndex = answerIndex;
    answered = true;
    try {
      await ensureGameSocketConnected();
    } catch (err) {
      error = 'Socket not connected.';
      answered = false;
      return;
    }
    const socket = getGameSocket();
    socket.emit('submit_answer', { gameId, answerIndex }, (ack: any) => {
      if (!ack || !ack.success) {
        // submission failed — revert answered so user can retry
        answered = false;
        error = ack?.message ?? 'Failed to submit answer.';
      }
    });
  }

  onMount(() => {
    setupSocket();
    loadInitialQuestion();
    // ask backend for current state via reconnection flow
    const socket = getGameSocket();
    if (!socket.connected) socket.connect();
  });

  onDestroy(() => {
    disconnectGameSocket();
  });
</script>

<svelte:head>
  <title>Multiplayer Game</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">
  <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-4">
    Multiplayer Quiz
  </h1>

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
      <p class="text-center text-blue-100 mb-4">Winner: <span class="font-bold text-pink-200">{nameOf(finalScore.winnerId)}</span></p>
      <div class="grid gap-2">
        {#each finalScore.ranking as entry}
          <div class="flex items-center justify-between px-3 py-2 rounded bg-gray-500/20 border border-white/10">
            <span class="text-blue-100">#{entry.rank} {nameOf(entry.playerId)}</span>
            <span class="text-pink-200 font-bold">{entry.score} / {totalQuestions}</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>
