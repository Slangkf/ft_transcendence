<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getGameSocket, disconnectGameSocket } from '$lib/shared/gameSocket';

  type BracketMatch = {
    round: number; slot: number;
    p1?: string; p2?: string;
    p1Nickname?: string; p2Nickname?: string;
    roomId?: string; gameId?: string;
    winnerId?: string;
    status: 'pending' | 'ready' | 'playing' | 'done';
  };
  type PlayerMatchStats = { correctAnswers: number; totalTime: number };
  type PublicBracketView = {
    tournamentId: string;
    status: 'waiting' | 'running' | 'finished';
    players: { userId: string; nickname: string }[];
    matches: BracketMatch[];
    finalRanking?: string[];
    playerStats?: Record<string, PlayerMatchStats>;
  };

  type SpectatorPlayer = { id: string; nickname?: string; score: number };
  type SpectatorUpdate = {
    tournamentId: string;
    gameId: string;
    status: 'playing' | 'finished';
    currentQuestionIndex: number;
    totalQuestions: number;
    question?: { id: number; question: string; options: string[] } | null;
    players: Record<string, SpectatorPlayer>;
  };

  // Keep this short: the server arms the 45s readiness deadline when the match
  // room is created, so a long pre-redirect would eat into the finalist's time
  // to click "Ready".
  const REDIRECT_DELAY_MS = 1500;
  const tournamentId = $derived(page.params.tournamentId);
  let bracket = $state<PublicBracketView | null>(null);
  let myUserId = $state('');
  let error = $state('');
  let info = $state('');
  let leaving = false;

  // Live feed of the final, pushed by the backend to the tournament room so
  // eliminated players can actually watch (scoreboard + current question).
  let spectatorFeed = $state<SpectatorUpdate | null>(null);

  // Set once the backend has written the final scores to the blockchain.
  let onchainTx = $state<{ txHash: string; explorerUrl: string } | null>(null);

  // Countdown shown to the user before being redirected to their next match room,
  // so they get to see the bracket update (yellow "waiting" / green "in the final" banner).
  let redirectRoomId = $state<string | null>(null);
  let redirectOpponent = $state<string | null>(null);
  let redirectCountdown = $state(0);
  let redirectInterval: ReturnType<typeof setInterval> | null = null;
  // HTTP safety-net poll: re-fetch the bracket every few seconds so a player whose
  // socket events were lost still discovers their 'ready' room and gets redirected.
  let bracketPoll: ReturnType<typeof setInterval> | null = null;

  function scheduleRedirect(roomId: string, opponent?: string) {
    if (redirectRoomId) return; // already scheduled
    redirectRoomId = roomId;
    redirectOpponent = opponent ?? null;
    redirectCountdown = Math.ceil(REDIRECT_DELAY_MS / 1000);
    redirectInterval = setInterval(() => {
      redirectCountdown -= 1;
      if (redirectCountdown <= 0) {
        if (redirectInterval) { clearInterval(redirectInterval); redirectInterval = null; }
        leaving = true;
        goto(`/game/multiplayer/room/${roomId}`);
      }
    }, 1000);
  }

  async function leaveTournament() {
    if (redirectInterval) { clearInterval(redirectInterval); redirectInterval = null; }
    redirectRoomId = null;
    try {
      await fetch('/api/tournament/leave', { method: 'POST', credentials: 'include' });
    } catch {}
    try {
      sessionStorage.removeItem('current_tournament_id');
      sessionStorage.removeItem('tournament_pending_room');
      sessionStorage.removeItem('mp_room_players');
    } catch {}
    leaving = true;
    disconnectGameSocket(); // force fresh socket on next tournament join
    goto('/game/tournament');
  }

  const nameOf = (id: string | undefined) =>
    !id ? '—' : (bracket?.players.find(p => p.userId === id)?.nickname ?? id);

  // Determine this player's current situation in the bracket
  const myRole = $derived(computeRole(bracket, myUserId));

  // The final match, once both finalists are known
  const finalMatch = $derived(bracket?.matches.find(m => m.round === 2));
  // Only trust the live feed once it matches the final's game (avoids briefly
  // showing a stale semi-final scoreboard when the final is about to start).
  const liveFinalFeed = $derived(
    spectatorFeed && spectatorFeed.gameId === finalMatch?.gameId ? spectatorFeed : null
  );
  const spectatorPlayers = $derived(
    liveFinalFeed ? Object.values(liveFinalFeed.players) : []
  );
  // An eliminated player watching the ongoing final = spectator
  const isSpectating = $derived(
    bracket?.status !== 'finished' &&
    myRole === 'eliminated' &&
    !!finalMatch?.p1 && !!finalMatch?.p2 &&
    finalMatch.status !== 'done'
  );

  function computeRole(b: PublicBracketView | null, uid: string): 'unknown' | 'eliminated' | 'advancing' | 'finalist' | 'winner' | 'watching' {
    if (!b || !uid) return 'unknown';
    if (!b.players.find(p => p.userId === uid)) return 'watching';

    if (b.status === 'finished') {
      if (b.finalRanking?.[0] === uid) return 'winner';
      return 'eliminated';
    }

    const final = b.matches.find(m => m.round === 2);
    if (final && (final.p1 === uid || final.p2 === uid) && final.status !== 'done') return 'finalist';

    const myR1 = b.matches.find(m => m.round === 1 && (m.p1 === uid || m.p2 === uid));
    if (myR1?.status === 'done') {
      return myR1.winnerId === uid ? 'advancing' : 'eliminated';
    }
    return 'unknown';
  }

  // Derive "do I have a match waiting for me to ready up?" purely from the bracket
  // state. This is the RELIABLE path: the bracket data arrives both via the socket
  // broadcast (bracket_update) AND via plain HTTP (fetchBracket / the poll below),
  // so it works even when the targeted `next_match_ready` socket event was lost
  // (e.g. the player's socketId wasn't in Redis at match-creation time → the log's
  // "NO socketId in Redis" → forfeited to the bracket). Only matches a 'ready' room
  // where I'm actually a participant, so an eliminated/spectating player is never
  // dragged into a match.
  function myReadyRoom(b: PublicBracketView | null, uid: string):
    { roomId: string; opponentNickname: string; players: { userId: string; nickname: string }[] } | null {
    if (!b || !uid || b.status === 'finished') return null;
    const m = b.matches.find(mm =>
      (mm.p1 === uid || mm.p2 === uid) && mm.status === 'ready' && !!mm.roomId);
    if (!m || !m.roomId) return null;
    const oppId = m.p1 === uid ? m.p2 : m.p1;
    const opp = b.players.find(p => p.userId === oppId);
    const p1 = b.players.find(p => p.userId === m.p1);
    const p2 = b.players.find(p => p.userId === m.p2);
    return {
      roomId: m.roomId,
      opponentNickname: opp?.nickname ?? oppId ?? '',
      players: [p1, p2].filter((p): p is { userId: string; nickname: string } => !!p)
        .map(p => ({ userId: p.userId, nickname: p.nickname })),
    };
  }

  // If the current bracket says I have a 'ready' room, head there. Idempotent:
  // scheduleRedirect() bails if a redirect is already scheduled, so calling this
  // from several places (socket events + HTTP poll) never double-redirects.
  function maybeRedirectFromBracket() {
    if (redirectRoomId) return;
    const r = myReadyRoom(bracket, myUserId);
    if (!r) return;
    try {
      sessionStorage.setItem('mp_room_players', JSON.stringify(r.players));
      if (bracket) sessionStorage.setItem('current_tournament_id', bracket.tournamentId);
    } catch {}
    scheduleRedirect(r.roomId, r.opponentNickname);
  }

  function setupListeners() {
    const socket = getGameSocket();
    socket.off('tournament_started');
    socket.off('bracket_update');
    socket.off('next_match_ready');
    socket.off('game_started');
    socket.off('tournament_finished');
    socket.off('tournament_onchain');
    socket.off('spectator_update');
    socket.off('error');

    // SAFETY NET: every one of the player's sockets is joined to the match room
    // (socketsJoin), so a tab that's still showing the BRACKET also receives the
    // room-broadcast `game_started`. The bracket has no other reason to act on it,
    // but if THIS tab is the one the player is looking at while their match starts
    // (e.g. they have a second tab, or the room→play redirect slipped), it would be
    // stranded on the bracket and unable to play. So: if I'm a participant of the
    // game that just started, jump to the play page. Eliminated/spectating players
    // are NOT in `players`, so they stay on the bracket to watch.
    socket.on('game_started', (payload: { gameId: string; firstQuestion: any; players: any; startedAt?: number; totalQuestions?: number }) => {
      const iAmIn = !!myUserId && !!payload.players && (
        Array.isArray(payload.players)
          ? payload.players.some((p: any) => String(p.id ?? p.userId) === myUserId)
          : !!payload.players[myUserId]
      );
      if (!iAmIn) return;
      try {
        sessionStorage.setItem('mp_first_question', JSON.stringify({
          gameId: payload.gameId, question: payload.firstQuestion, players: payload.players,
          startedAt: payload.startedAt, totalQuestions: payload.totalQuestions,
        }));
        if (bracket) sessionStorage.setItem('current_tournament_id', bracket.tournamentId);
      } catch {}
      leaving = true; // suppress the bracket's onDestroy socket teardown
      goto(`/game/multiplayer/play/${payload.gameId}`);
    });

    socket.on('tournament_started', (payload: { tournamentId: string; bracket: PublicBracketView }) => {
      bracket = payload.bracket;
      onchainTx = null;
      maybeRedirectFromBracket();
    });

    socket.on('bracket_update', (payload: { tournamentId: string; bracket: PublicBracketView }) => {
      bracket = payload.bracket;
      maybeRedirectFromBracket();
    });

    socket.on('next_match_ready', (payload: { tournamentId: string; roomId: string; opponentId: string; opponentNickname: string; round: number; players: { userId: string; nickname: string }[] }) => {
      info = `Round ${payload.round} : you play against ${payload.opponentNickname}.`;
      try {
        sessionStorage.setItem('mp_room_players', JSON.stringify(payload.players ?? []));
        sessionStorage.setItem('current_tournament_id', payload.tournamentId);
      } catch {}
      scheduleRedirect(payload.roomId, payload.opponentNickname);
    });

    socket.on('tournament_finished', (payload: { tournamentId: string; bracket: PublicBracketView; winnerId: string; ranking: string[] }) => {
      bracket = payload.bracket;
      spectatorFeed = null;
      try { sessionStorage.removeItem('current_tournament_id'); } catch {}
    });

    socket.on('tournament_onchain', (payload: { tournamentId: string; txHash: string; explorerUrl: string }) => {
      onchainTx = { txHash: payload.txHash, explorerUrl: payload.explorerUrl };
    });

    socket.on('spectator_update', (payload: SpectatorUpdate) => {
      // Only mirror the match we're actually spectating (the final). Updates for
      // a still-running semi-final carry a different gameId and are ignored.
      const finalGameId = bracket?.matches.find(m => m.round === 2)?.gameId;
      if (finalGameId && payload.gameId !== finalGameId) return;
      spectatorFeed = payload;
    });

    socket.on('error', (payload: { message: string }) => {
      error = payload.message ?? 'Socket error';
    });
  }

  async function fetchBracket() {
    try {
      const resp = await fetch(`/api/tournament/${tournamentId}`, { credentials: 'include' });
      const json = await resp.json();
      if (resp.ok && json?.success) {
        bracket = json.data as PublicBracketView;
        // Tournament is over: drop the "current tournament" context NOW, not only on
        // the tournament_finished socket event (which the winner often arrives too
        // late to catch). Otherwise the stale id leaks into the next plain game whose
        // end screen then wrongly redirects back to this finished bracket.
        if (bracket?.status === 'finished') {
          try {
            sessionStorage.removeItem('current_tournament_id');
            sessionStorage.removeItem('tournament_pending_room');
            sessionStorage.removeItem('mp_room_players');
          } catch {}
        }
      } else {
        error = json?.message ?? 'Tournament not found';
      }
    } catch (e) {
      console.error(e);
      error = 'Network error';
    }
  }

  onMount(async () => {
    // Fetch current user id for personalised display
    try {
      const r = await fetch('/api/user/me', { credentials: 'include' });
      if (r.ok) {
        const j = await r.json();
        myUserId = String(j.id ?? '');
      }
    } catch {}

    const socket = getGameSocket();
    if (!socket.active) socket.connect();
    setupListeners();

    // Always load the bracket first so the user can see who's where during the redirect countdown
    await fetchBracket();

    // Reliable path: derive the redirect straight from the freshly fetched bracket
    // (works even if every socket event was missed).
    maybeRedirectFromBracket();

    // If next_match_ready arrived during navigation (race condition).
    // Never honour this for an eliminated player or a finished tournament — a
    // stale pending room must not drag a spectator back into an old match.
    try {
      const pendingRoom = sessionStorage.getItem('tournament_pending_room');
      sessionStorage.removeItem('tournament_pending_room');
      if (pendingRoom && myRole !== 'eliminated' && bracket?.status !== 'finished') {
        scheduleRedirect(pendingRoom);
        return;
      }
    } catch {}

    // HTTP safety net: keep polling the bracket. This is the ONLY channel that does
    // not depend on the socket at all, so it rescues a player whose socketId was
    // missing in Redis (no next_match_ready, not even bracket_update). Stops itself
    // once a redirect is scheduled or the tournament is over.
    bracketPoll = setInterval(async () => {
      if (redirectRoomId || bracket?.status === 'finished') {
        if (bracketPoll) { clearInterval(bracketPoll); bracketPoll = null; }
        return;
      }
      await fetchBracket();
      maybeRedirectFromBracket();
    }, 3000);
  });

  onDestroy(() => {
    if (redirectInterval) { clearInterval(redirectInterval); redirectInterval = null; }
    if (bracketPoll) { clearInterval(bracketPoll); bracketPoll = null; }
    // Remove this page's handlers from the shared singleton socket so they don't keep
    // running (and mutating a destroyed component's closures) once we're on the
    // room/play page.
    try {
      const s = getGameSocket();
      s.off('tournament_started');
      s.off('bracket_update');
      s.off('next_match_ready');
      s.off('game_started');
      s.off('tournament_finished');
      s.off('tournament_onchain');
      s.off('spectator_update');
      s.off('error');
    } catch {}
    if (!leaving) {
      // user navigated away manually — keep socket alive if still in tournament
      let inTournament = false;
      try { inTournament = !!sessionStorage.getItem('current_tournament_id'); } catch {}
      if (!inTournament) disconnectGameSocket();
    }
  });

  function statusBadge(s: BracketMatch['status']): string {
    switch (s) {
      case 'pending': return 'Waiting';
      case 'ready': return 'Ready';
      case 'playing': return 'Playing';
      case 'done': return 'Done';
    }
  }
</script>

<svelte:head>
  <title>Tournament Bracket</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">

  <!-- Tournament finished: winner screen -->
  {#if bracket?.status === 'finished' && bracket.finalRanking}
    <div class="text-center mb-8">
      {#if myRole === 'winner'}
        <h1 class="text-3xl sm:text-4xl font-bold text-yellow-300 mb-2">You won the tournament!</h1>
        <p class="text-blue-100/80">Congratulations!</p>
      {:else}
        <h1 class="text-2xl sm:text-3xl font-bold text-pink-200 mb-2">Tournament over</h1>
        <p class="text-blue-100/80">
          Winner: <span class="font-bold text-yellow-300">{nameOf(bracket.finalRanking[0])}</span>
        </p>
      {/if}
    </div>

    <section class="mb-8">
      <h2 class="text-pink-200 font-bold text-center mb-3">Final ranking</h2>
      <div class="grid gap-2">
        {#each bracket.finalRanking as uid, i}
          {@const stats = bracket.playerStats?.[uid]}
          <div class="flex items-center justify-between px-4 py-3 rounded border
            {uid === myUserId ? 'bg-pink-500/20 border-pink-300/40' : 'bg-gray-500/20 border-white/10'}">
            <span class="text-blue-100">
              {#if i === 0}🥇{:else if i === 1}🥈{:else if i === 2}🥉{:else}#{i + 1}{/if}
              {nameOf(uid)}
              {#if uid === myUserId}<span class="text-pink-200 text-sm ml-1">(you)</span>{/if}
            </span>
            <span class="flex items-center gap-3">
              {#if stats}
                <span class="text-xs text-blue-100/70">
                  {stats.correctAnswers} good answers - In {(stats.totalTime / 1000).toFixed(1)}s
                </span>
              {/if}
              {#if i === 0}<span class="text-yellow-300 font-bold">Champion</span>{/if}
            </span>
          </div>
        {/each}
      </div>
    </section>

    <!-- Blockchain certification badge -->
    <div class="text-center mb-8">
      {#if onchainTx}
        <a href={onchainTx.explorerUrl} target="_blank" rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-300/40 text-emerald-100 text-sm hover:bg-emerald-500/30 transition">
          Certified scores on the blockchain (Avalanche Fuji)
          <span class="font-mono text-xs text-emerald-200/80">{onchainTx.txHash.slice(0, 10)}…</span>
        </a>
      {:else}
        <p class="text-xs text-blue-100/40">Score recording on the blockchain…</p>
      {/if}
    </div>

    <div class="flex justify-center gap-4">
      <a href="/modes" class="px-6 py-3 rounded bg-white/20 hover:bg-white/30 border border-white/20 text-blue-100 font-semibold transition">
        Back to menu
      </a>
      <button type="button" onclick={leaveTournament}
        class="px-6 py-3 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-blue-100/70 transition">
        Play again
      </button>
    </div>

  {:else}
    <!-- Tournament in progress -->
    <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-1">
      Tournament
    </h1>
    <p class="text-center text-xs text-blue-100/50 mb-4">{tournamentId}</p>

    <!-- Status banner for current user -->
    {#if myRole === 'advancing'}
      <div class="mb-4 rounded bg-yellow-500/20 border border-yellow-300/30 px-4 py-3 text-yellow-100 text-center">
        Waiting for your final opponent...
      </div>
    {:else if myRole === 'finalist'}
      <div class="mb-4 rounded bg-green-500/20 border border-green-300/30 px-4 py-3 text-green-100 text-center">
        You're in the final! Redirecting to your match...
      </div>
    {:else if myRole === 'eliminated'}
      <div class="mb-4 rounded bg-white/10 border border-white/20 px-4 py-3 text-blue-100/70 text-center">
        You're eliminated. Watch the final below.
      </div>
    {/if}

    {#if redirectRoomId}
      <div class="mb-4 rounded bg-green-500/25 border border-green-300/40 px-4 py-3 text-green-100 text-center">
        {#if redirectOpponent}
          Final against <span class="font-bold">{redirectOpponent}</span> —
        {/if}
        redirection in
        <span class="font-mono font-bold text-lg">{redirectCountdown}s</span>
      </div>
    {/if}

    <!-- Spectator window: eliminated player watching the ongoing final -->
    {#if isSpectating && finalMatch}
      <div class="mb-6 rounded-lg border border-purple-300/40 bg-purple-500/15 px-5 py-4">
        <div class="flex items-center justify-center gap-2 mb-3">
          <span class="inline-flex items-center gap-1 rounded-full bg-purple-400/30 px-3 py-1 text-xs font-bold text-purple-100 uppercase tracking-wide">
            <span class="h-2 w-2 rounded-full bg-purple-200 animate-pulse"></span>
            Spectator mode
          </span>
        </div>
        <p class="text-center text-blue-100/80 text-sm mb-3">
          You are eliminated! You attend the final as a spectator.
        </p>
        {#if spectatorPlayers.length}
          <!-- Live scoreboard pushed from the ongoing final -->
          <div class="grid gap-2 mb-3">
            {#each spectatorPlayers as sp}
              <div class="flex items-center justify-between px-4 py-2 rounded bg-purple-500/15 border border-purple-300/20">
                <span class="text-blue-100">{sp.nickname ?? nameOf(sp.id)}</span>
                <span class="text-pink-200 font-bold text-lg">{sp.score}</span>
              </div>
            {/each}
          </div>
          {#if liveFinalFeed && liveFinalFeed.status === 'playing'}
            <p class="text-center text-xs text-purple-100/70 mb-2">
              Question {liveFinalFeed.currentQuestionIndex + 1}{#if liveFinalFeed.totalQuestions > 0} / {liveFinalFeed.totalQuestions}{/if}
            </p>
            {#if liveFinalFeed.question}
              <p class="text-center text-blue-100 font-semibold px-2">{liveFinalFeed.question.question}</p>
            {/if}
          {/if}
        {:else}
          <div class="flex items-center justify-center gap-4 text-lg">
            <span class="font-bold text-blue-100">{nameOf(finalMatch.p1)}</span>
            <span class="text-purple-200/70 text-sm">vs</span>
            <span class="font-bold text-blue-100">{nameOf(finalMatch.p2)}</span>
          </div>
        {/if}
        <p class="text-center text-xs text-purple-100/70 mt-2">
          {finalMatch.status === 'playing' ? 'Final is underway…' : 'The final is about to begin…'}
        </p>
      </div>
    {/if}

    {#if error}
      <div class="mb-4 rounded bg-red-500/20 border border-red-300/30 px-4 py-3 text-red-100">{error}</div>
    {/if}
    {#if info}
      <div class="mb-4 rounded bg-white/10 border border-white/20 px-4 py-3 text-blue-100">{info}</div>
    {/if}

    <div class="flex justify-end mb-2">
      <button type="button" onclick={leaveTournament}
        class="text-xs px-3 py-1 rounded bg-white/10 hover:bg-red-500/20 border border-white/10 text-blue-100/50 hover:text-red-200 transition">
        Leave tournament
      </button>
    </div>

    {#if !bracket}
      <p class="text-center text-blue-100/80">Loading round...</p>
    {:else}
      <div class="grid gap-6 md:grid-cols-2">
        <!-- Semi-finals -->
        <div>
          <h2 class="text-pink-200 font-bold mb-2 text-center">Semi-finals</h2>
          <div class="grid gap-3">
            {#each bracket.matches.filter(m => m.round === 1) as m}
              <div class="px-3 py-2 rounded border
                {(m.p1 === myUserId || m.p2 === myUserId) ? 'bg-pink-500/15 border-pink-300/30' : 'bg-gray-500/20 border-white/10'}">
                <div class="flex items-center justify-between">
                  <span class="{m.winnerId === m.p1 ? 'text-green-300 font-bold' : m.status === 'done' ? 'text-blue-100/50 line-through' : 'text-blue-100'}
                    {m.p1 === myUserId ? ' underline' : ''}">
                    {nameOf(m.p1)}
                  </span>
                  <span class="text-pink-200/70 text-sm">vs</span>
                  <span class="{m.winnerId === m.p2 ? 'text-green-300 font-bold' : m.status === 'done' ? 'text-blue-100/50 line-through' : 'text-blue-100'}
                    {m.p2 === myUserId ? ' underline' : ''}">
                    {nameOf(m.p2)}
                  </span>
                </div>
                <p class="text-center text-xs text-blue-100/70 mt-1">{statusBadge(m.status)}</p>
              </div>
            {/each}
          </div>
        </div>

        <!-- Final -->
        <div>
          <h2 class="text-pink-200 font-bold mb-2 text-center">Final</h2>
          {#each bracket.matches.filter(m => m.round === 2) as m}
            <div class="px-3 py-2 rounded border
              {(m.p1 === myUserId || m.p2 === myUserId) ? 'bg-pink-500/15 border-pink-300/30' : 'bg-gray-500/20 border-white/10'}">
              <div class="flex items-center justify-between">
                <span class="{m.winnerId === m.p1 ? 'text-green-300 font-bold' : m.status === 'done' ? 'text-blue-100/50 line-through' : 'text-blue-100'}
                  {m.p1 === myUserId ? ' underline' : ''}">
                  {nameOf(m.p1)}
                </span>
                <span class="text-pink-200/70 text-sm">vs</span>
                <span class="{m.winnerId === m.p2 ? 'text-green-300 font-bold' : m.status === 'done' ? 'text-blue-100/50 line-through' : 'text-blue-100'}
                  {m.p2 === myUserId ? ' underline' : ''}">
                  {nameOf(m.p2)}
                </span>
              </div>
              <p class="text-center text-xs text-blue-100/70 mt-1">{statusBadge(m.status)}</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
