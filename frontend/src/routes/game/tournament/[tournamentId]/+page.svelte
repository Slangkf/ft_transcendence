<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getGameSocket, disconnectGameSocket } from '$lib/gameSocket';

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
  let error = $state('');
  let info = $state('');
  let leaving = false;

  const nameOf = (id: string | undefined) =>
    !id ? '—' : (bracket?.players.find(p => p.userId === id)?.nickname ?? id);

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
      info = `Round ${payload.round} : tu joues contre ${payload.opponentNickname}.`;
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
        error = json?.message ?? 'Tournoi introuvable';
      }
    } catch (e) {
      console.error(e);
      error = 'Erreur réseau';
    }
  }

  onMount(() => {
    const socket = getGameSocket();
    if (!socket.connected) socket.connect();
    setupListeners();
    fetchBracket();
  });

  onDestroy(() => {
    if (!leaving) {
      // user closed the bracket page on purpose
    }
  });

  function statusBadge(s: BracketMatch['status']): string {
    switch (s) {
      case 'pending': return 'En attente';
      case 'ready': return 'Prêt';
      case 'playing': return 'En cours';
      case 'done': return 'Terminé';
    }
  }
</script>

<svelte:head>
  <title>Tournament Bracket</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">
  <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-2">
    Tournament
  </h1>
  <p class="text-center text-sm text-blue-100/80 mb-6">{tournamentId}</p>

  {#if error}
    <div class="mb-4 rounded bg-red-500/20 border border-red-300/30 px-4 py-3 text-red-100">{error}</div>
  {/if}
  {#if info}
    <div class="mb-4 rounded bg-white/10 border border-white/20 px-4 py-3 text-blue-100">{info}</div>
  {/if}

  {#if !bracket}
    <p class="text-center text-blue-100/80">Chargement du bracket...</p>
  {:else}
    <div class="grid gap-6 md:grid-cols-2">
      <!-- Round 1 -->
      <div>
        <h2 class="text-pink-200 font-bold mb-2 text-center">Demi-finales</h2>
        <div class="grid gap-3">
          {#each bracket.matches.filter(m => m.round === 1) as m}
            <div class="px-3 py-2 rounded bg-gray-500/20 border border-white/10">
              <div class="flex items-center justify-between">
                <span class={m.winnerId === m.p1 ? 'text-green-300 font-bold' : 'text-blue-100'}>
                  {nameOf(m.p1)}
                </span>
                <span class="text-pink-200/70 text-sm">vs</span>
                <span class={m.winnerId === m.p2 ? 'text-green-300 font-bold' : 'text-blue-100'}>
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
        <h2 class="text-pink-200 font-bold mb-2 text-center">Finale</h2>
        {#each bracket.matches.filter(m => m.round === 2) as m}
          <div class="px-3 py-2 rounded bg-gray-500/20 border border-white/10">
            <div class="flex items-center justify-between">
              <span class={m.winnerId === m.p1 ? 'text-green-300 font-bold' : 'text-blue-100'}>
                {nameOf(m.p1)}
              </span>
              <span class="text-pink-200/70 text-sm">vs</span>
              <span class={m.winnerId === m.p2 ? 'text-green-300 font-bold' : 'text-blue-100'}>
                {nameOf(m.p2)}
              </span>
            </div>
            <p class="text-center text-xs text-blue-100/70 mt-1">{statusBadge(m.status)}</p>
          </div>
        {/each}
      </div>
    </div>

    {#if bracket.status === 'finished' && bracket.finalRanking}
      <section class="mt-8">
        <h2 class="text-pink-200 font-bold text-center mb-3">Classement final</h2>
        <div class="grid gap-2">
          {#each bracket.finalRanking as uid, i}
            <div class="flex items-center justify-between px-3 py-2 rounded bg-gray-500/20 border border-white/10">
              <span class="text-blue-100">#{i + 1} {nameOf(uid)}</span>
              {#if i === 0}<span class="text-yellow-300 font-bold">Vainqueur</span>{/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>
