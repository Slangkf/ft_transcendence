<script lang="ts">
  import { page } from '$app/state';

  const mode = $derived(page.url.searchParams.get('mode') ?? 'solo');
  const category = $derived(page.url.searchParams.get('category') ?? '');

  type PublicQuestion = {
    id: number;
    question: string;
    options: string[];
  };

  type PublicGameState = {
    gameId: string;
    players: Record<string, { id: string; score: number; isAI?: boolean }>;
    currentQuestionIndex: number;
    isFinished: boolean;
    totalQuestions: number;
  };

  type FinalScore = {
    gameId: string;
    players: Record<string, { id: string; score: number; isAI?: boolean }>;
    winner: string;
    finishedAt: number;
  };

  type StartGameApiResponse = {
    success: boolean;
    message: string;
    data: {
      gameId: string;
      question: PublicQuestion;
    } | null;
  };

  type AnswerApiResponse = {
    success: boolean;
    message: string;
    data: {
      gameresult: PublicGameState;
      correctAnswer?: string;
      nextQuestion?: PublicQuestion | null;
      finalscore?: FinalScore;
    } | null;
  };

  const REVEAL_DELAY_MS = 1500;

  let gameId = $state<string | null>(null);
  let currentQuestion = $state<PublicQuestion | null>(null);
  let pendingNextQuestion = $state<PublicQuestion | null>(null);
  let score = $state(0);
  let isFinished = $state(false);
  let feedback = $state('');
  let error = $state('');
  let loading = $state(false);
  let questionNumber = $state(0);
  let totalQuestions = $state(0);
  let selectedIndex = $state<number | null>(null);
  let correctIndex = $state<number | null>(null);
  let revealing = $state(false);

  function extractScore(players: Record<string, { score: number }>): number {
    const values = Object.values(players);
    return values.length > 0 ? values[0].score : 0;
  }

  function resetReveal() {
    selectedIndex = null;
    correctIndex = null;
    revealing = false;
  }

  async function startGame() {
    loading = true;
    error = '';
    feedback = '';
    isFinished = false;
    score = 0;
    currentQuestion = null;
    pendingNextQuestion = null;
    gameId = null;
    questionNumber = 0;
    totalQuestions = 0;
    resetReveal();

    try {
      const response = await fetch(`/api/game/${mode}/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category ? { category } : {})
      });

      const result: StartGameApiResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        error = result?.message ?? 'Impossible de démarrer la partie.';
        return;
      }

      gameId = result.data.gameId;
      currentQuestion = result.data.question;
      questionNumber = 1;
    } catch (err) {
      console.error('startGame error:', err);
      error = 'Erreur réseau ou backend inaccessible.';
    } finally {
      loading = false;
    }
  }

  async function submitAnswer(answerIndex: number) {
    if (!gameId || !currentQuestion || isFinished || revealing) return;

    const selectedOptionText = currentQuestion.options[answerIndex];

    loading = true;
    error = '';

    try {
      const response = await fetch(
        `/api/game/${mode}/${gameId}/answer`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedAnswerIndex: answerIndex })
        }
      );

      const result: AnswerApiResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        error = result?.message ?? 'Erreur lors de l’envoi de la réponse.';
        return;
      }

      const data = result.data;
      score = extractScore(data.gameresult.players);
      totalQuestions = data.gameresult.totalQuestions;

      const correct = data.correctAnswer ?? '';
      const correctIdx = currentQuestion.options.findIndex(opt => opt === correct);
      const isCorrect = selectedOptionText === correct;

      selectedIndex = answerIndex;
      correctIndex = correctIdx;
      revealing = true;
      feedback = isCorrect ? 'Correct answer.' : `Wrong answer. Correct answer: ${correct}`;

      if (data.finalscore) {
        setTimeout(() => {
          isFinished = true;
          currentQuestion = null;
          feedback = '';
          resetReveal();
        }, REVEAL_DELAY_MS);
      } else {
        pendingNextQuestion = data.nextQuestion ?? null;
        setTimeout(() => {
          currentQuestion = pendingNextQuestion;
          pendingNextQuestion = null;
          if (currentQuestion) questionNumber += 1;
          feedback = '';
          resetReveal();
        }, REVEAL_DELAY_MS);
      }
    }
    catch (err) {
      console.error('submitAnswer error:', err);
      error = 'Erreur réseau pendant la réponse.';
    } finally {
      loading = false;
    }
  }

  function buttonClasses(index: number): string {
    const base = 'w-full text-left px-4 py-3 rounded border transition disabled:cursor-not-allowed';
    if (revealing) {
      if (index === correctIndex) {
        return `${base} bg-green-500/40 border-green-300/60 text-white`;
      }
      if (index === selectedIndex) {
        return `${base} bg-red-500/40 border-red-300/60 text-white`;
      }
      return `${base} bg-gray-500/15 border-white/10 text-blue-100/60`;
    }
    return `${base} bg-gray-500/25 hover:bg-gray-400/35 border-white/20 text-blue-100 disabled:opacity-50`;
  }
</script>

<svelte:head>
  <title>Game</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">
  <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-2">
    QUIZ GAME
  </h1>

  {#if category}
    <p class="text-center text-sm text-blue-100 mb-4">Category: <span class="font-semibold text-pink-200">{category}</span></p>
  {/if}

  <div class="flex justify-center mb-6">
    <button
      type="button"
      onclick={startGame}
      disabled={loading || revealing}
      class="px-6 py-3 rounded bg-white/20 hover:bg-white/30 border border-white/20 text-blue-100 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {#if loading}
        Loading...
      {:else if gameId && !isFinished}
        Restart game
      {:else}
        Start game
      {/if}
    </button>
  </div>

  <div class="text-center mb-4">
    <p class="text-sm sm:text-base md:text-lg text-blue-100">
      Score: <span class="font-bold text-pink-200">{score}</span>
    </p>
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

  {#if currentQuestion}
    <section class="mt-6">
      {#if questionNumber > 0}
        <p class="text-center text-sm text-blue-100/80 mb-2">
          Question {questionNumber}{#if totalQuestions > 0} / {totalQuestions}{/if}
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
            disabled={loading || revealing}
            class={buttonClasses(index)}
          >
            {option}
          </button>
        {/each}
      </div>
    </section>
  {/if}

  {#if isFinished}
    <section class="mt-6">
      <h2 class="text-base sm:text-xl md:text-2xl font-semibold text-pink-200 p-4 text-center">
        Game finished
      </h2>
      <p class="text-sm sm:text-base md:text-xl p-4 text-center text-blue-100">
        Final score: <span class="font-bold text-pink-200">{score}{#if totalQuestions > 0} / {totalQuestions}{/if}</span>
      </p>
    </section>
  {/if}
</div>
