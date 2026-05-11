<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { getGameSocket, disconnectGameSocket } from '$lib/gameSocket';

  type PublicQuestion = { id: number; question: string; options: string[] };
  type PublicPlayer = { id: string; score: number; isAI?: boolean };
  type PublicGameState = {
    gameId: string;
    players: Record<string, PublicPlayer>;
    currentQuestionIndex: number;
    isFinished: boolean;
    totalQuestions: number;
  };
  type PlayingGameInfo = {
    gameresult: PublicGameState;
    correctAnswer: string;
    nextQuestion: PublicQuestion | null;
  };
  type FinalScore = {
    gameId: string;
    players: Record<string, PublicPlayer>;
    winner: string;
    finishedAt: number;
  };
  type FinishedGameInfo = {
    gameresult: PublicGameState;
    finalscore: FinalScore;
  };
  type GameInfo = PlayingGameInfo | FinishedGameInfo;

  const REVEAL_DELAY_MS = 1500;
  const gameId = $derived(page.params.gameId);

  let currentQuestion = $state<PublicQuestion | null>(null);
  let pendingNext = $state<PublicQuestion | null>(null);
  let questionNumber = $state(1);
  let totalQuestions = $state(0);
  let playersState = $state<PublicPlayer[]>([]);
  let myUserId = $state<string | null>(null);
  let isFinished = $state(false);
  let finalScore = $state<FinalScore | null>(null);
  let feedback = $state('');
  let error = $state('');
  let selectedIndex = $state<number | null>(null);
  let correctIndex = $state<number | null>(null);
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

  function isPlaying(info: GameInfo): info is PlayingGameInfo {
    return (info as PlayingGameInfo).correctAnswer !== undefined;
  }

  function applyAnswerResult(info: GameInfo) {
    const state = info.gameresult;
    totalQuestions = state.totalQuestions;
    playersState = Object.values(state.players);

    if (!isPlaying(info)) {
      // game finished
      const finished = info as FinishedGameInfo;
      revealing = false;
      answered = false;
      isFinished = true;
      finalScore = finished.finalscore;
      currentQuestion = null;
      feedback = '';
      return;
    }

    const correct = info.correctAnswer;
    if (!correct) {
      // partial state: another player submitted but round not yet over
      return;
    }

    if (currentQuestion) {
      const idx = currentQuestion.options.findIndex(o => o === correct);
      correctIndex = idx;
      revealing = true;
      const mySelected = selectedIndex !== null
        ? currentQuestion.options[selectedIndex]
        : null;
      feedback = mySelected === null
        ? `Correct answer: ${correct}`
        : (mySelected === correct ? 'Correct answer.' : `Wrong answer. Correct answer: ${correct}`);
    }

    pendingNext = info.nextQuestion;
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
    socket.off('reconnection');
    socket.off('error');

    socket.on('answer_result', (info: GameInfo) => {
      applyAnswerResult(info);
    });

    socket.on('reconnection', (payload: { roomId: string; gameId: string; state: PublicGameState }) => {
      totalQuestions = payload.state.totalQuestions;
      playersState = Object.values(payload.state.players);
      questionNumber = payload.state.currentQuestionIndex + 1;
      isFinished = payload.state.isFinished;
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

  function submitAnswer(answerIndex: number) {
    if (!currentQuestion || answered || revealing || isFinished) return;
    selectedIndex = answerIndex;
    answered = true;
    const socket = getGameSocket();
    socket.emit('submit_answer', { gameId, answerIndex });
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
        <span class="text-blue-100 text-sm">{p.id}</span>
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
      <p class="text-center text-blue-100 mb-4">Winner: <span class="font-bold text-pink-200">{finalScore.winner}</span></p>
      <div class="grid gap-2">
        {#each Object.values(finalScore.players) as p}
          <div class="flex items-center justify-between px-3 py-2 rounded bg-gray-500/20 border border-white/10">
            <span class="text-blue-100">{p.id}</span>
            <span class="text-pink-200 font-bold">{p.score} / {totalQuestions}</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>
