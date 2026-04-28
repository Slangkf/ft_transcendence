<script lang="ts">
  import { page } from '$app/state';

  const mode = $derived(page.url.searchParams.get('mode') ?? 'solo');

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

  let gameId = $state<string | null>(null);
  let currentQuestion = $state<PublicQuestion | null>(null);
  let score = $state(0);
  let isFinished = $state(false);
  let feedback = $state('');
  let error = $state('');
  let loading = $state(false);

  function extractScore(players: Record<string, { score: number }>): number {
    const values = Object.values(players);
    return values.length > 0 ? values[0].score : 0;
  }

  async function startGame() {
    loading = true;
    error = '';
    feedback = '';
    isFinished = false;
    score = 0;
    currentQuestion = null;
    gameId = null;

    try {
      const response = await fetch(`/api/game/${mode}/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      const result: StartGameApiResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        error = result?.message ?? 'Impossible de démarrer la partie.';
        return;
      }

      gameId = result.data.gameId;
      currentQuestion = result.data.question;
    } catch (err) {
      console.error('startGame error:', err);
      error = 'Erreur réseau ou backend inaccessible.';
    } finally {
      loading = false;
    }
  }

  async function submitAnswer(selectedAnswerIndex: number) {
    if (!gameId || !currentQuestion || isFinished) return;

    const selectedOptionText = currentQuestion.options[selectedAnswerIndex];

    loading = true;
    error = '';

    try {
      const response = await fetch(
        `/api/game/${mode}/${gameId}/answer`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedAnswerIndex })
        }
      );

      const result: AnswerApiResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        error = result?.message ?? 'Erreur lors de l’envoi de la réponse.';
        return;
      }

      const data = result.data;
      score = extractScore(data.gameresult.players);
      isFinished = data.gameresult.isFinished;

      if (data.finalscore) {
        currentQuestion = null;
        feedback = '';
      } else {
        const correct = data.correctAnswer ?? '';
        const isCorrect = selectedOptionText === correct;
        feedback = isCorrect ? 'Correct answer.' : `Wrong answer. Correct answer: ${correct}`;
        currentQuestion = data.nextQuestion ?? null;
      }
    }
    catch (err) {
      console.error('submitAnswer error:', err);
      error = 'Erreur réseau pendant la réponse.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Game</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">
  <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-6">
    QUIZ GAME
  </h1>

  <div class="flex justify-center mb-6">
    <button
      type="button"
      onclick={startGame}
      disabled={loading}
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
      <h2 class="text-base sm:text-xl md:text-2xl font-semibold text-pink-200 p-4 text-center">
        {currentQuestion.question}
      </h2>

      <div class="grid gap-3 p-4">
        {#each currentQuestion.options as option, index}
          <button
            type="button"
            onclick={() => submitAnswer(index)}
            disabled={loading}
            class="w-full text-left px-4 py-3 rounded bg-gray-500/25 hover:bg-gray-400/35 border border-white/20 text-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
        Final score: <span class="font-bold text-pink-200">{score}</span>
      </p>
    </section>
  {/if}
</div>
