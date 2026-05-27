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
  type PublicBracketView = {
    tournamentId: string;
    status: 'waiting' | 'running' | 'finished';
    players: { userId: string; nickname: string }[];
    matches: BracketMatch[];
    finalRanking?: string[];
  };

  const tournamentId = $derived(page.params.tournamentId);
  let bracket = $state<PublicBracketView | null>(null);
  let myUserId = $state('');
  let error = $state('');
  let info = $state('');
  let leaving = false;

  async function leaveTournament() {
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

  function setupListeners() {
    const socket = getGameSocket();
    socket.off('tournament_started');
    socket.off('bracket_update');
    socket.off('next_match_ready');
    socket.off('tournament_finished');
    socket.off('error');

    socket.on('tournament_started', (payload: { tournamentId: string; bracket: PublicBracketView }) => {
      bracket = payload.bracket;
    });

    socket.on('bracket_update', (payload: { tournamentId: string; bracket: PublicBracketView }) => {
      bracket = payload.bracket;
    });

    socket.on('next_match_ready', (payload: { tournamentId: string; roomId: string; opponentId: string; opponentNickname: string; round: number; players: { userId: string; nickname: string }[] }) => {
      info = `Round ${payload.round} : you play against ${payload.opponentNickname}.`;
      try {
        sessionStorage.setItem('mp_room_players', JSON.stringify(payload.players ?? []));
        sessionStorage.setItem('current_tournament_id', payload.tournamentId);
      } catch {}
      leaving = true;
      goto(`/game/multiplayer/room/${payload.roomId}`);
    });

    socket.on('tournament_finished', (payload: { tournamentId: string; bracket: PublicBracketView; winnerId: string; ranking: string[] }) => {
      bracket = payload.bracket;
      try { sessionStorage.removeItem('current_tournament_id'); } catch {}
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
    if (!socket.connected) socket.connect();
    setupListeners();

    // If next_match_ready arrived during navigation (race condition on initial join)
    try {
      const pendingRoom = sessionStorage.getItem('tournament_pending_room');
      if (pendingRoom) {
        sessionStorage.removeItem('tournament_pending_room');
        leaving = true;
        goto(`/game/multiplayer/room/${pendingRoom}`);
        return;
      }
    } catch {}

    // Fallback: server knows if this user has a ready room (handles dropped next_match_ready)
    try {
      const resp = await fetch('/api/tournament/my/room', { credentials: 'include' });
      const json = await resp.json();
      if (resp.ok && json?.data?.roomId) {
        leaving = true;
        goto(`/game/multiplayer/room/${json.data.roomId}`);
        return;
      }
    } catch {}

    fetchBracket();
  });

  onDestroy(() => {
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
        <p class="text-blue-100/80">Congratulations, champion!</p>
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
          <div class="flex items-center justify-between px-4 py-3 rounded border
            {uid === myUserId ? 'bg-pink-500/20 border-pink-300/40' : 'bg-gray-500/20 border-white/10'}">
            <span class="text-blue-100">
              {#if i === 0}🥇{:else if i === 1}🥈{:else if i === 2}🥉{:else}#{i + 1}{/if}
              {nameOf(uid)}
              {#if uid === myUserId}<span class="text-pink-200 text-sm ml-1">(you)</span>{/if}
            </span>
            {#if i === 0}<span class="text-yellow-300 font-bold">Champion</span>{/if}
          </div>
        {/each}
      </div>
    </section>

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
      <p class="text-center text-blue-100/80">Loading bracket...</p>
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
