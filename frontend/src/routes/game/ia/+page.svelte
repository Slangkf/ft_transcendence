<script lang="ts">
  import { page } from '$app/state';
  import { onDestroy } from 'svelte';

  const category = $derived(page.url.searchParams.get('category') ?? '');

  // --- 类型定义 ---
  type PublicQuestion = {
    id: number;
    question: string;
    options: string[];
  };

  type PlayerSnapshot = {
    id: string;
    nickname?: string;
    score: number;
    status: 'waiting' | 'answered' | string; // 修正 status 类型
    isAI?: boolean;
    lastSelectedIndex?: number; // 🌟 扩展字段：记录最后一次选择的索引
    lastIsCorrect?: boolean;    // 🌟 扩展字段：记录最后一次是否正确
  };

  type RankingEntry = {
    playerId: string;
    nickname?: string;
    score: number;
    rank: number;
    totalTime: number;
    isAI?: boolean;
  };

  type GameUpdateResponse = {
    gameId: string;
    status: 'playing' | 'finished';
    state: {
      currentQuestionIndex: number;
      totalQuestions: number;
      player: Record<string, PlayerSnapshot>;
      startedAt: number;
      questionStartedAt: number;
    };
    lastAnswerUpdate?: {
      playerId: string;
      isCorrect: boolean;
      correctAnswerIndex: number;
      correctText: string;
    };
    nextQuestion?: PublicQuestion | null;
    finalScore?: {
      winnerId: string;
      scores: Record<string, number>;
      ranking: RankingEntry[];
    } | null;
  };

  type ApiResponse<T> = { success: boolean; message: string; data: T | null };

  const QUESTION_TIME_MS = 30_000;
  // 延长一点揭晓时间，给用户足够的时间看清 AI 的选择（建议 2.5s - 3s）
  const REVEAL_DELAY_MS = 2500; 

  // --- 状态 ---
  let gameId = $state<string | null>(null);
  let currentQuestion = $state<PublicQuestion | null>(null);
  let players = $state<Record<string, PlayerSnapshot>>({});
  let finalRanking = $state<RankingEntry[]>([]);
  let isFinished = $state(false);
  let error = $state('');
  let loading = $state(false);
  let questionNumber = $state(0);
  let totalQuestions = $state(0);
  
  // 🌟 揭晓阶段的独立状态
  let revealing = $state(false);
  let hasSubmittedCurrent = $state(false);
  let currentCorrectIndex = $state<number | null>(null);
  let timeLeft = $state(0);
  let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);

  const playersList = $derived(Object.values(players));
  const timerPercent = $derived(QUESTION_TIME_MS > 0 ? (timeLeft / QUESTION_TIME_MS) * 100 : 0);
  const timerDanger = $derived(timeLeft <= 5_000 && timeLeft > 0);

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
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
    revealing = false;
    currentCorrectIndex = null;
  }

  // --- 开始游戏 ---
  async function startAIGame() {
    stopTimer();
    loading = true;
    error = '';
    isFinished = false;
    currentQuestion = null;
    gameId = null;
    questionNumber = 0;
    totalQuestions = 0;
    players = {};
    finalRanking = [];
    hasSubmittedCurrent = false;
    resetReveal();

    try {
      const response = await fetch('/api/game/ai/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category ? { category } : {})
      });

      const result: ApiResponse<GameUpdateResponse> = await response.json();

      if (!response.ok || !result.success || !result.data || !result.data.nextQuestion) {
        error = result?.message ?? 'Impossible de démarrer la partie contre l\'IA.';
        return;
      }

      const data = result.data;
      gameId = data.gameId;
      currentQuestion = data.nextQuestion ?? null;
      totalQuestions = data.state?.totalQuestions ?? 0;
      questionNumber = (data.state?.currentQuestionIndex ?? 0) + 1;
      players = data.state?.player ?? {};
      startTimer();
    } catch (err) {
      console.error('startAIGame error:', err);
      error = 'Erreur réseau ou backend inaccessible.';
    } finally {
      loading = false;
    }
  }

  // --- 提交答案 ---
  async function submitAnswer(answerIndex: number, isTimeout = false) {
    if (!gameId || !currentQuestion || isFinished || revealing || hasSubmittedCurrent) return;

    loading = true;
    revealing = true;
    hasSubmittedCurrent = true;
    stopTimer();

    try {
      const response = await fetch(`/api/game/ai/${gameId}/answer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedAnswerIndex: answerIndex })
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        hasSubmittedCurrent = false;
        revealing = false;
        loading = false;
        error = result?.message ?? 'Erreur lors de l\'envoi de la réponse.';
        return;
      }

      const data: GameUpdateResponse = result.data;

      if (data.lastAnswerUpdate?.correctText === 'ALREADY_PROCESSED') {
        revealing = false;
        hasSubmittedCurrent = false;
        loading = false;
        return;
      }

      // 🌟 核心改动：捕获正确答案索引
      const correctIdx = data.lastAnswerUpdate?.correctAnswerIndex ?? 0;
      currentCorrectIndex = correctIdx;

      // 🌟 核心改动：本地猜测/计算出 AI 选了什么（因为单包返回中，AI 如果答题了，其 score 会发生变化）
      // 我们通过最新的 data.state.player 更新本地玩家状态，并补充各自的选项信息用于前端渲染
      const nextPlayers = { ...data.state?.player };
      
      Object.keys(nextPlayers).forEach(id => {
        const p = nextPlayers[id];
        if (p.isAI) {
          // 如果 AI 这一题得分比上一题变多了，说明它答对了，选的是正确答案
          // 如果没变，说明它打错了（这里有个小瑕疵：由于没传 AI 错选了哪个，我们暂定它错选时挂载在非正确选项上，或通过后端扩展提供。这里默认对的显示在正确项，错的通过状态标红）
          const oldScore = players[id]?.score ?? 0;
          p.lastIsCorrect = p.score > oldScore;
          p.lastSelectedIndex = p.lastIsCorrect ? correctIdx : -1; // -1 代表错选项
        } else {
          // 人类玩家的选择
          p.lastSelectedIndex = answerIndex;
          p.lastIsCorrect = !isTimeout && answerIndex === correctIdx;
        }
      });

      players = nextPlayers;
      totalQuestions = data.state?.totalQuestions ?? totalQuestions;

      // 定时器：展示结果一段时间后，切入下一题或结束
      if (data.status === 'finished') {
        if (data.finalScore) {
          finalRanking = data.finalScore.ranking.map(r => ({
            ...r,
            isAI: players[r.playerId]?.isAI ?? false,
          }));
        }
        setTimeout(() => {
          isFinished = true;
          currentQuestion = null;
          resetReveal();
          hasSubmittedCurrent = false;
          stopTimer();
        }, REVEAL_DELAY_MS);
      } else {
        const nextQ = data.nextQuestion;
        setTimeout(() => {
          currentQuestion = nextQ ?? null;
          questionNumber = (data.state?.currentQuestionIndex ?? 0) + 1;
          players = data.state?.player ?? players; // 切题后重置状态
          resetReveal();
          hasSubmittedCurrent = false;
          startTimer();
        }, REVEAL_DELAY_MS);
      }
    } catch (err) {
      console.error('submitAnswer error:', err);
      error = 'Erreur réseau pendant la réponse.';
      hasSubmittedCurrent = false;
      revealing = false;
    } finally {
      loading = false;
    }
  }

  onDestroy(() => {
    stopTimer();
  });

  // --- 动态按钮样式 ---
  function buttonClasses(index: number): string {
    const base = 'w-full text-left px-4 py-3 rounded border transition disabled:cursor-not-allowed flex flex-col gap-1';
    
    if (revealing) {
      // 当前项是正确答案
      if (index === currentCorrectIndex) {
        return `${base} bg-green-500/30 border-green-400 text-green-100 font-medium`;
      }
      // 当前项是玩家点选的错误答案
      const humanPlayer = playersList.find(p => !p.isAI);
      if (humanPlayer && humanPlayer.lastSelectedIndex === index && !humanPlayer.lastIsCorrect) {
        return `${base} bg-red-500/30 border-red-400 text-red-100`;
      }
      return `${base} bg-gray-500/10 border-white/5 text-blue-100/40`;
    }
    
    return `${base} bg-gray-500/25 hover:bg-gray-400/35 border-white/20 text-blue-100`;
  }
</script>

<svelte:head>
  <title>VS AI Game</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">

  <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-2 tracking-wider">
    HUMAN VS AI
  </h1>

  {#if category}
    <p class="text-center text-sm text-blue-100 mb-4">
      Category: <span class="font-semibold text-pink-200">{category}</span>
    </p>
  {/if}

  <div class="flex justify-center mb-6">
    <button
      type="button"
      onclick={startAIGame}
      disabled={loading || revealing}
      class="px-6 py-3 rounded bg-white/20 hover:bg-white/30 border border-white/20 text-blue-100 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {#if loading && !revealing}
        Loading...
      {:else if gameId && !isFinished}
        Restart Game
      {:else}
        Challenge AI
      {/if}
    </button>
  </div>

  {#if playersList.length > 0 && !isFinished}
    <div class="mb-6 p-4 rounded bg-black/20 border border-white/10">
      <p class="text-xs font-sans text-blue-300 uppercase tracking-widest text-center mb-3">Live Scoreboard</p>
      <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
        {#each playersList as p}
          <div class="flex flex-col items-center p-3 rounded bg-white/5 border border-white/5 relative overflow-hidden">
            <div class="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded font-sans uppercase font-bold tracking-wider 
              {p.status === 'answered' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
              {p.status === 'answered' ? '✓ Done' : '⏳ Thinking'}
            </div>

            <span class="text-sm font-semibold text-blue-100 mt-2">
              {p.isAI ? `🤖 ${p.nickname ?? 'AI'}` : `👤 ${p.nickname ?? 'You'}`}
            </span>
            <span class="text-2xl font-bold text-pink-200 mt-1">{p.score} <span class="text-xs font-normal text-blue-300">pts</span></span>
            
            {#if revealing}
              <div class="text-xs mt-1 font-sans transition-all">
                {#if p.lastIsCorrect}
                  <span class="text-green-400 font-bold">✅ Correct (+10)</span>
                {:else}
                  <span class="text-red-400 font-bold">❌ Incorrect (0)</span>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if error}
    <div class="mb-4 rounded bg-red-500/20 border border-red-300/30 px-4 py-3 text-red-100 text-center">
      {error}
    </div>
  {/if}

  {#if currentQuestion}
    <section class="mt-6">
      {#if questionNumber > 0}
        <p class="text-center text-sm text-blue-100/80 mb-2 font-sans">
          Question {questionNumber}{#if totalQuestions > 0} / {totalQuestions}{/if}
        </p>
      {/if}
      <div class="mx-4 mb-3 font-sans">
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
            <span class="flex justify-between items-center w-full">
              <span class="font-medium">{option}</span>
              
              {#if revealing}
                <div class="flex gap-2 items-center">
                  {#each playersList as p}
                    {#if p.isAI}
                      {#if p.lastSelectedIndex === index}
                        <span class="bg-blue-500/20 text-xs px-2 py-0.5 rounded border border-blue-400 text-blue-200 flex items-center gap-1" title="AI Choice">
                          🤖 AI ✅
                        </span>
                      {/if}
                    {:else}
                      {#if p.lastSelectedIndex === index}
                        <span class="bg-pink-500/20 text-xs px-2 py-0.5 rounded border border-pink-400 text-pink-200 flex items-center gap-1" title="Your Choice">
                          👤 You {p.lastIsCorrect ? '✅' : '❌'}
                        </span>
                      {/if}
                    {/if}
                  {/each}
                </div>
              {/if}
            </span>
          </button>
        {/each}
      </div>
    </section>
  {/if}

  {#if isFinished}
    <section class="mt-6 p-6 border border-pink-200/20 rounded bg-white/5 text-center">
      <h2 class="text-xl sm:text-2xl font-bold text-pink-200 mb-2">
        🏆 Game Finished
      </h2>

      {#if finalRanking.length > 0}
        {@const winner = finalRanking[0]}
        <p class="text-lg text-blue-100 mb-6 font-sans">
          {winner.isAI ? '🤖 AI won the match!' : '🎉 Congratulations, You won!'}
        </p>

        <div class="max-w-md mx-auto grid gap-3 text-left">
          {#each finalRanking as p}
            <div class="flex justify-between items-center px-4 py-4 rounded {p.rank === 1 ? 'bg-pink-200/10 border-2 border-pink-300' : 'bg-black/20 border border-white/5'}">
              <span class="text-blue-100 font-medium flex items-center gap-3">
                <span class="text-2xl">{p.rank === 1 ? '🥇' : '🥈'}</span>
                <span class="text-base font-sans">
                  {p.isAI ? `🤖 ${p.nickname ?? 'AI Bot'}` : `👤 ${p.nickname ?? 'You'}`}
                </span>
              </span>
              <div class="flex flex-col items-end">
                <span class="font-bold text-pink-200 text-2xl font-sans">
                  {p.score} <span class="text-xs text-blue-300/70 font-normal">pts</span>
                </span>
                <span class="text-[11px] text-blue-100/40 font-sans">Time spent: {(p.totalTime / 1000).toFixed(1)}s</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

</div>
