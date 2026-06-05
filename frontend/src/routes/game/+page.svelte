<script lang="ts">
  import { page } from '$app/state';

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

  // ── 游戏状态 ──────────────────────────────────────────
  let gameId          = $state<string | null>(null);
  let currentQuestion = $state<PublicQuestion | null>(null);
  let myScore         = $state(0);
  let aiScore         = $state(0);
  let aiNickname      = $state('AI');
  let isFinished      = $state(false);
  let feedback        = $state('');
  let error           = $state('');
  let loading         = $state(false);
  let questionNumber  = $state(0);
  let totalQuestions  = $state(0);
  let selectedIndex   = $state<number | null>(null);
  let correctIndex    = $state<number | null>(null);
  let revealing       = $state(false);
  let finalScore      = $state<GameUpdateResponse['finalScore']>(null);

  // ── 倒计时 ────────────────────────────────────────────
  let timeLeft        = $state(0);           // 剩余毫秒数
  let timerInterval   = $state<ReturnType<typeof setInterval> | null>(null);

  // ── AI 视觉 ───────────────────────────────────────────
  let aiThinking      = $state(false);
  let aiAnswered      = $state(false);
  let aiThinkTimer    = $state<ReturnType<typeof setTimeout> | null>(null);

  // ── 工具函数 ──────────────────────────────────────────
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

  // ── 倒计时控制 ────────────────────────────────────────
  function startTimer() {
    stopTimer();
    timeLeft = QUESTION_TIME_MS;
    timerInterval = setInterval(() => {
      timeLeft -= 100;
      if (timeLeft <= 0) {
        timeLeft = 0;
        stopTimer();
        // 时间到，自动超时提交
        submitAnswer(-1, true);
      }
    }, 100);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  // ── AI 视觉动画 ───────────────────────────────────────
  function startAIThinking() {
    if (!isAIMode) return;
    aiAnswered = false;
    aiThinking = true;
    if (aiThinkTimer) clearTimeout(aiThinkTimer);
    // 2~5秒内随机"完成思考"，和后端 predictAnswer 的 thinkingDelayMs 范围一致
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

  function resetAIState() {
    stopAIThinking();
    aiAnswered = false;
  }

  // ── 重置每题状态 ──────────────────────────────────────
  function resetRound() {
    selectedIndex = null;
    correctIndex  = null;
    revealing     = false;
    feedback      = '';
    resetAIState();
  }

  // ── 开始游戏 ──────────────────────────────────────────
  async function startGame() {
    stopTimer();
    loading     = true;
    error       = '';
    isFinished  = false;
    myScore     = 0;
    aiScore     = 0;
    gameId      = null;
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
      gameId         = data.gameId;
      currentQuestion = data.nextQuestion ?? null;
      totalQuestions  = data.state?.totalQuestions ?? 0;
      questionNumber  = (data.state?.currentQuestionIndex ?? 0) + 1;
      updateScores(data.state?.player ?? {});

      startTimer();
      startAIThinking();
    } catch (err) {
      error = 'Erreur réseau ou backend inaccessible.';
    } finally {
      loading = false;
    }
  }

  // ── 提交答案 ──────────────────────────────────────────
  async function submitAnswer(answerIndex: number, isTimeout = false) {
    if (!gameId || !currentQuestion || isFinished || revealing) return;

    revealing = true;
    stopTimer();
    stopAIThinking();

    // 超时时 AI 视觉上立刻显示已作答
    if (isTimeout) aiAnswered = true;

    loading = true;
    error   = '';

    try {
      const res = await fetch(`/api/game/${mode}/${gameId}/answer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedAnswerIndex: answerIndex })
      });
      const result: ApiResponse<GameUpdateResponse> = await res.json();

      if (!res.ok || !result.success || !result.data) {
        error = result?.message ?? "Erreur lors de l'envoi de la réponse.";
        revealing = false;
        return;
      }

      const data = result.data;
      updateScores(data.state?.player ?? {});
      totalQuestions = data.state?.totalQuestions ?? totalQuestions;

      // 显示答案反馈
      const correctText = data.lastAnswerUpdate?.correctText ?? '';
      const correctIdx  = data.lastAnswerUpdate?.correctAnswerIndex
        ?? currentQuestion.options.findIndex(o => o === correctText);
      const isCorrect   = data.lastAnswerUpdate?.isCorrect ?? false;

      selectedIndex = answerIndex;
      correctIndex  = correctIdx;

      if (isTimeout) {
        feedback = `⏰ Temps écoulé ! La bonne危险 : ${correctText}`;
      } else {
        feedback = isCorrect ? 'Bonne réponse !' : `Mauvaise réponse. La bonne réponse : ${correctText}`;
      }

      // 锁住下一题（闭包捕获，防止异步污染）
      const nextQ = data.nextQuestion ? { ...data.nextQuestion } : null;

      // 1.5s 后切题
      setTimeout(() => {
        if (data.status === 'finished' || data.finalScore) {
          finalScore = data.finalScore ?? null;
          isFinished = true;
          currentQuestion = null;
          resetRound();
          return;
        }

        currentQuestion = nextQ;
        if (currentQuestion) questionNumber++;
        resetRound();
        startTimer();
        startAIThinking();
      }, REVEAL_DELAY_MS);

    } catch {
      error     = 'Erreur réseau pendant la réponse.';
      revealing = false;
    } finally {
      loading = false;
    }
  }

  // ── 按钮样式 ──────────────────────────────────────────
  function buttonClasses(index: number): string {
    const base = 'w-full text-left px-4 py-3 rounded border transition disabled:cursor-not-allowed';
    if (revealing) {
      if (index === correctIndex)  return `${base} bg-green-500/40 border-green-300/60 text-white`;
      if (index === selectedIndex && selectedIndex !== -1)
                                   return `${base} bg-red-500/40 border-red-300/60 text-white`;
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

  {#if isAIMode && gameId}
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
  {:else if !isAIMode}
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
    {#key currentQuestion.id}
      <section class="mt-6">
        {#if questionNumber > 0}
          <p class="text-center text-sm text-blue-100/80 mb-2">
            Question {questionNumber}{#if totalQuestions > 0} / {totalQuestions}{/if}
          </p>
        {/if}

        <div class="mb-4 px-4">
          <div class="flex justify-between text-xs text-blue-100/60 mb-1">
            <span>Temps restant</span>
            <span class:text-red-400={timerDanger}>{Math.ceil(timeLeft / 1000)}s</span>
          </div>
          <div class="w-full h-2 rounded bg-white/10 overflow-hidden">
            <div
              class="h-full rounded transition-all duration-100"
              class:bg-pink-400={!timerDanger}
              class:bg-red-500={timerDanger}
              style="width: {timerPercent}%"
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
              disabled={loading || revealing}
              class={buttonClasses(index)}
            >
              {option}
            </button>
          {/each}
        </div>
      </section>
    {/key}
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
        onclick={startGame}
        class="mt-6 px-6 py-3 rounded bg-white/20 hover:bg-white/30 border border-white/20 text-blue-100 font-semibold transition"
      >
        Play again
      </button>
    </section>
  {/if}
</div>