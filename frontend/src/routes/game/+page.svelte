<script lang="ts">
  import { page } from '$app/state';
  import { onDestroy } from 'svelte';
  import {goto} from '$app/navigation';
  import {onMount} from 'svelte';

  const QUESTION_TIME_MS = 30_000;   // 答题总时长
  const REVEAL_DELAY_MS  = 1_500;    // 显示答案后切题延迟

  const mode     = $derived(page.url.searchParams.get('mode') ?? 'solo');
  const category = $derived(page.url.searchParams.get('category') ?? '');
  const isAIMode = $derived(mode === 'ai' || mode === 'AI');

  type PublicQuestion  = { id: number; question: string; options: string[] };
  type PlayerSnapshot  = { id: string; nickname?: string; score: number; status: string; isAI?: boolean };
  type GameUpdateResponse = {
    gameId: string;
    status: 'playing' | 'finished';
    state: {
      currentQuestionIndex: number;
      totalQuestions: number;
      player: Record<string, PlayerSnapshot>;
      questionStartedAt?: number;
    };
    lastAnswerUpdate?: {
      playerId: string;
      isCorrect: boolean;
      correctAnswerIndex: number;
      correctText: string;
    } | null;
    nextQuestion?: PublicQuestion | null;
    finalScore?: {
      winnerId: string;
      scores: Record<string, number>;
      ranking: Array<{ playerId: string; nickname?: string; score: number; rank: number }>;
    } | null;
  };
  type ApiResponse<T> = { success: boolean; message: string; data: T | null };

  let gameId = $state<string | null>(null);
  let currentQuestion = $state<PublicQuestion | null>(null);
  let pendingNextQuestion = $state<PublicQuestion | null>(null);
  let myScore = $state(0);
  let aiScore = $state(0);
  let aiNickname = $state('AI');
  let aiThinking = $state(false);       // AI 思考动画开关
  let aiAnswered = $state(false);       // AI 已作答标志
  let aiThinkTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let isFinished = $state(false);
  let feedback = $state('');
  let error = $state('');
  let loading = $state(false);
  let questionNumber = $state(0);
  let totalQuestions = $state(0);
  let selectedIndex = $state<number | null>(null);
  let correctIndex = $state<number | null>(null);
  let revealing = $state(false);
  let finalScore = $state<GameUpdateResponse['finalScore']>(null);
  let timeLeft = $state(0);
  let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);
  let transitionTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let hasSubmittedCurrent = $state(false);

  // 从 player map 里提取人类和 AI 的 snapshot
  function extractPlayers(players: Record<string, PlayerSnapshot>) {
    const all = Object.values(players);
    return { me: all.find(p => !p.isAI), ai: all.find(p => p.isAI) };
  }

  // 进度条百分比 0→100
  const timerPercent = $derived(
    QUESTION_TIME_MS > 0 ? (timeLeft / QUESTION_TIME_MS) * 100 : 0
  );

  // 最后5秒变红
  const timerDanger = $derived(timeLeft <= 5_000 && timeLeft > 0);

  function updateScores(players: Record<string, PlayerSnapshot>) {
    const { me, ai } = extractPlayers(players);
    if (me) myScore = me.score;
    if (ai) { aiScore = ai.score; aiNickname = ai.nickname ?? 'AI'; }
  }

  // ── AI 视觉动画 ───────────────────────────────────────
  function startAIThinking() {
    if (!isAIMode) return;
    aiAnswered = false;
    aiThinking = true;
    if (aiThinkTimer) clearTimeout(aiThinkTimer);
    const delay = Math.random() * 3000 + 2000;
    aiThinkTimer = setTimeout(() => {
      aiThinking = false;
      aiAnswered = true;
    }, delay);
  }

  function stopAIThinking() {
    if (aiThinkTimer) { clearTimeout(aiThinkTimer); aiThinkTimer = null; }
    aiThinking = false;
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // ── 答题逻辑处理 ───────────────────────────────────────
  function clearTransitionTimer() {
    if (transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }
  }

  function scheduleTransition(callback: () => void) {
    clearTransitionTimer();
    transitionTimer = setTimeout(() => {
      transitionTimer = null;
      callback();
    }, REVEAL_DELAY_MS);
  }

  function startTimer() {
    stopTimer();
    timeLeft = QUESTION_TIME_MS;
    timerInterval = setInterval(() => {
      timeLeft = Math.max(0, timeLeft - 100);
      if (timeLeft <= 0) {
        stopTimer();
        submitAnswer(-1, true);
      }
    }, 100);
  }

  function resetReveal() {
    selectedIndex = null;
    correctIndex = null;
    revealing = false;
  }

  function resetAIState() {
    stopAIThinking();
    aiAnswered = false;
  }

  function resetRound() {
    selectedIndex = null;
    correctIndex  = null;
    revealing     = false;
    hasSubmittedCurrent = false;
    feedback      = '';
    resetAIState();
  }

  async function startGame() {
    clearTransitionTimer();
    stopTimer();
    loading = true;
    error = '';
    feedback = '';
    isFinished = false;
    myScore = 0;
    aiScore = 0;
    currentQuestion = null;
    questionNumber  = 0;
    totalQuestions  = 0;
    finalScore      = null;
    resetRound();

    try {
      const res = await fetch(`/api/game/${mode}/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category ? { category } : {})
      });
      const result: ApiResponse<GameUpdateResponse> = await res.json();

      if (!res.ok || !result.success || !result.data?.nextQuestion) {
        error = result?.message ?? 'Impossible de démarrer la partie.';
        return;
      }

      const data = result.data;
      gameId          = data.gameId;
      currentQuestion = data.nextQuestion ?? null;
      totalQuestions  = data.state?.totalQuestions ?? 0;
      questionNumber  = (data.state?.currentQuestionIndex ?? 0) + 1;
      updateScores(data.state?.player ?? {});

      startAIThinking();
      startTimer();
    } catch (err) {
      error = 'Erreur réseau ou backend inaccessible.';
    } finally {
      loading = false;
    }
  }

  async function submitAnswer(answerIndex: number, isTimeout = false) {
    if (!gameId || !currentQuestion || isFinished || revealing || hasSubmittedCurrent) return;

    const submittedQuestionId = currentQuestion.id;
    hasSubmittedCurrent = true;
    loading = true;
    revealing = true;
    error = '';
    feedback = '';

    selectedIndex = isTimeout ? -1 : answerIndex;

    stopTimer();
    stopAIThinking();

    if (isTimeout) aiAnswered = true;

    try {
      const res = await fetch(`/api/game/${mode}/${gameId}/answer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedAnswerIndex: answerIndex,
          questionId: submittedQuestionId
        })
      });
      const result: ApiResponse<GameUpdateResponse> = await res.json();

      if (!res.ok || !result.success || !result.data) {
        error = result?.message ?? "Erreur lors de l'envoi de la réponse.";
        revealing = false;
        return;
      }

      const data = result.data;
      const nextPlayers = data.state?.player ?? {};
      const nextTotalQuestions = data.state?.totalQuestions ?? totalQuestions;

      if (data.lastAnswerUpdate) {
        correctIndex = data.lastAnswerUpdate.correctAnswerIndex;
      }

      const correctText = data.lastAnswerUpdate?.correctText ?? '';
      const isCorrect   = data.lastAnswerUpdate?.isCorrect ?? false;
      
      // 立刻渲染当前题目的正确/错误文字提示
      feedback = isTimeout
        ? `Time is up. Correct answer: ${correctText}`
        : isCorrect ? 'Correct answer.' : `Wrong answer. Correct answer: ${correctText}`;

      if (data.lastAnswerUpdate?.correctText === 'ALREADY_PROCESSED') {
        if (transitionTimer) return;

        if (data.status === 'finished' || data.finalScore) {
          scheduleTransition(() => {
            updateScores(nextPlayers);
            totalQuestions = nextTotalQuestions;
            finalScore = data.finalScore ?? null;
            isFinished = true;
            currentQuestion = null;
            feedback = ''; // 【修复】切到游戏结束，清空提示
            resetReveal();
            hasSubmittedCurrent = false;
            resetAIState();
            stopTimer();
          });
        } else if (data.nextQuestion && data.nextQuestion.id !== submittedQuestionId) {
          const nextQuestion = data.nextQuestion;
          scheduleTransition(() => {
            currentQuestion = nextQuestion;
            questionNumber = (data.state?.currentQuestionIndex ?? questionNumber) + 1;
            updateScores(nextPlayers);
            totalQuestions = nextTotalQuestions;
            feedback = ''; // 【修复】切到下一题，清空提示
            resetReveal();
            hasSubmittedCurrent = false;
            resetAIState();
            startAIThinking();
            startTimer();
          });
        } else {
          resetReveal();
          hasSubmittedCurrent = false;
          startTimer();
        }
        return;
      }

      if (data.status === 'finished' || data.finalScore) {
        scheduleTransition(() => {
          updateScores(nextPlayers);
          totalQuestions = nextTotalQuestions;
          finalScore = data.finalScore ?? null;
          isFinished = true;
          currentQuestion = null;
          feedback = ''; // 【修复】结算时清空提示
          resetReveal();
          hasSubmittedCurrent = false;
          resetAIState();
          stopTimer();
        });
      } else {
        pendingNextQuestion = data.nextQuestion ?? null;
        scheduleTransition(() => {
          currentQuestion = pendingNextQuestion;
          pendingNextQuestion = null;
          questionNumber = (data.state?.currentQuestionIndex ?? questionNumber) + 1;
          updateScores(nextPlayers);
          totalQuestions = nextTotalQuestions;
          feedback = ''; // 【修复】核心改动点：在此处 1.5 秒后切题时，将 feedback 文字清空
          resetReveal();
          hasSubmittedCurrent = false;
          resetAIState();
          startAIThinking();
          startTimer();
        });
      }
    } catch (err) {
      console.error('submitAnswer error:', err);
      error = 'Erreur réseau pendant la réponse.';
      revealing = false;
      hasSubmittedCurrent = false;
    } finally {
      loading = false;
    }
  }

  onDestroy(() => {
    clearTransitionTimer();
    stopTimer();
    stopAIThinking();
  });

  function buttonClasses(index: number): string {
    const base = 'w-full text-left px-4 py-3 rounded border transition disabled:cursor-not-allowed';
    
    if (revealing) {
      if (index === correctIndex) {
        return `${base} bg-green-500/40 border-green-300/60 text-white`;
      }
      if (index === selectedIndex && selectedIndex !== correctIndex) {
        return `${base} bg-red-500/40 border-red-300/60 text-white`;
      }
      return `${base} bg-gray-500/15 border-white/10 text-blue-100/60`;
    }
    
    return `${base} bg-gray-500/25 hover:bg-gray-400/35 border-white/20 text-blue-100 disabled:opacity-50`;
  }

  async function backToCategories() {
    await goto(`/game/categories?mode=${mode}`);

    gameId = null;
    isFinished = false;
    currentQuestion = null;
    feedback = '';
    error = ''
  }

  onMount(() => {
    const shouldStart = category || page.url.searchParams.get("autostart") === 'true';
    if (shouldStart)  startGame();
  })
</script>

<svelte:head>
  <title>Game</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">
  <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-2">
    QUIZ GAME
  </h1>

  {#if category}
    <p class="text-center text-sm text-blue-100 mb-4">
      Category: <span class="font-semibold text-pink-200">{category}</span>
    </p>
  {/if}

  {#if !isFinished}
    <div class="flex justify-center mb-6">
      <button
        type="button"
        onclick={startGame}
        disabled={loading || revealing}
        class="px-6 py-3 rounded bg-white/20 hover:bg-white/30 border border-white/20 text-blue-100 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if loading}Loading...
        {:else if gameId}Restart game
        {:else}Start game{/if}
      </button>
    </div>
  {/if}

  {#if isAIMode && gameId && !isFinished}
    <div class="flex gap-4 mb-6">
      <div class="flex-1 rounded bg-white/10 border border-white/20 px-4 py-3 text-center">
        <p class="text-xs text-blue-100/60 mb-1">You</p>
        <p class="text-2xl font-bold text-pink-200">{myScore}</p>
      </div>
      <div class="flex items-center text-blue-100/40 font-bold text-sm">VS</div>
      <div class="flex-1 rounded bg-white/10 border border-white/20 px-4 py-3 text-center">
        <p class="text-xs text-blue-100/60 mb-1">{aiNickname}</p>
        <p class="text-2xl font-bold text-pink-200">{aiScore}</p>
        <div class="mt-1 h-5 flex items-center justify-center">
          {#if aiThinking}
            <span class="text-xs text-blue-100/50 animate-pulse">thinking...</span>
          {:else if aiAnswered}
            <span class="text-xs text-green-300/80">✓ answered</span>
          {/if}
        </div>
      </div>
    </div>
  {:else if !isAIMode && !isFinished}
    <div class="text-center mb-4">
      <p class="text-sm sm:text-base md:text-lg text-blue-100">
        Score: <span class="font-bold text-pink-200">{myScore}</span>
      </p>
    </div>
  {/if}

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
      <div class="mx-4 mb-3">
        <div class="flex justify-between text-xs text-blue-100/70 mb-1">
          <span>Time</span>
          <span class={timerDanger ? 'text-red-300 font-semibold' : 'text-blue-100/70'}>
            {Math.ceil(timeLeft / 1000)}s
          </span>
        </div>
        <div class="h-2 rounded bg-white/10 overflow-hidden">
          <div
            class={timerDanger ? 'h-full bg-red-400 transition-all' : 'h-full bg-pink-300 transition-all'}
            style={`width: ${timerPercent}%`}
          ></div>
        </div>
      </div>
      <h2 class="text-base sm:text-xl md:text-2xl font-semibold text-pink-200 p-4 text-center">
        {currentQuestion.question}
      </h2>
      <div class="grid gap-3 p-4">
        {#each currentQuestion.options as option, index}
          <button
            type="button"
            onclick={() => submitAnswer(index)}
            disabled={loading || revealing || hasSubmittedCurrent}
            class={buttonClasses(index)}
          >
            {option}
          </button>
        {/each}
      </div>
    </section>
  {/if}

  {#if isFinished}
    <section class="mt-6 text-center">
      <h2 class="text-base sm:text-xl md:text-2xl font-semibold text-pink-200 p-4">
        Game finished
      </h2>
      {#if isAIMode && finalScore}
        <p class="text-lg font-bold text-pink-200 mb-2">
          {#if myScore > aiScore}
            You win! 🎉
          {:else if aiScore > myScore}
            {aiNickname} wins!
          {:else}
            Draw! 🤝
          {/if}
        </p>
        <div class="flex gap-4 mt-4">
          <div class="flex-1 rounded bg-white/10 border border-white/20 px-4 py-3 text-center">
            <p class="text-xs text-blue-100/60 mb-1">You</p>
            <p class="text-2xl font-bold text-pink-200">{myScore}</p>
          </div>
          <div class="flex items-center text-blue-100/40 font-bold text-sm">VS</div>
          <div class="flex-1 rounded bg-white/10 border border-white/20 px-4 py-3 text-center">
            <p class="text-xs text-blue-100/60 mb-1">{aiNickname}</p>
            <p class="text-2xl font-bold text-pink-200">{aiScore}</p>
          </div>
        </div>
      {:else}
        <p class="text-sm sm:text-base md:text-xl p-4 text-blue-100">
          Final score: <span class="font-bold text-pink-200">{myScore}{#if totalQuestions > 0} / {totalQuestions}{/if}</span>
        </p>
      {/if}

      <button
        type="button"
        onclick={backToCategories}
        class="mt-6 px-6 py-3 rounded bg-white/20 hover:bg-white/30 border border-white/20 text-blue-100 font-semibold transition"
      >
        Play again
      </button>
    </section>
  {/if}
</div>