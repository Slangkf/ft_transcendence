<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getGameSocket, disconnectGameSocket } from '$lib/gameSocket';

  type StartApiResponse = { success: boolean; message: string; data: any };

  let waiting = $state(false);
  let error = $state('');
  let info = $state('');
  let joinedTournament: string | null = null;

  async function ensureSocketConnected(): Promise<void> {
    const socket = getGameSocket();
    if (socket.connected) return;
    await new Promise<void>((resolve, reject) => {
      const onConnect = () => { cleanup(); resolve(); };
      const onErr = (err: any) => { cleanup(); reject(err); };
      const cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onErr);
      };
      socket.once('connect', onConnect);
      socket.once('connect_error', onErr);
      if (!socket.active) socket.connect();
    });
  }

  function setupListeners() {
    const socket = getGameSocket();

    socket.off('tournament_started');
    socket.off('bracket_update');
    socket.off('next_match_ready');
    socket.off('reconnect');
    socket.off('error');

    socket.on('tournament_started', (payload: { tournamentId: string }) => {
      joinedTournament = payload.tournamentId;
      try { sessionStorage.setItem('current_tournament_id', payload.tournamentId); } catch {}
      goto(`/game/tournament/${payload.tournamentId}`);
    });

    socket.on('bracket_update', (payload: { tournamentId: string }) => {
      // already in a tournament — go to bracket
      joinedTournament = payload.tournamentId;
      try { sessionStorage.setItem('current_tournament_id', payload.tournamentId); } catch {}
      goto(`/game/tournament/${payload.tournamentId}`);
    });

    // covers a race where next_match_ready arrives before we navigate to the bracket page
    socket.on('next_match_ready', (payload: { tournamentId: string; roomId: string; players: { userId: string; nickname: string }[] }) => {
      joinedTournament = payload.tournamentId;
      try {
        sessionStorage.setItem('current_tournament_id', payload.tournamentId);
        sessionStorage.setItem('mp_room_players', JSON.stringify(payload.players ?? []));
      } catch {}
      goto(`/game/multiplayer/room/${payload.roomId}`);
    });

    socket.on('error', (payload: { message: string }) => {
      error = payload.message ?? 'Socket error';
    });
  }

  onMount(() => {
    const socket = getGameSocket();
    if (!socket.connected) socket.connect();
    setupListeners();
  });

  async function joinTournament() {
    error = '';
    info = '';
    waiting = true;
    try {
      await ensureSocketConnected();
      setupListeners();
      const response = await fetch('/api/tournament/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      let result: StartApiResponse | null = null;
      try { result = await response.json(); } catch {
        error = `Backend error (HTTP ${response.status}).`;
        waiting = false;
        return;
      }

      if (response.status === 401) {
        error = 'You are not logged in. Please log in to play.';
        waiting = false;
        return;
      }

      if (!response.ok && response.status !== 202) {
        error = result?.message ?? 'Failed to join tournament.';
        waiting = false;
        return;
      }

      if (result?.data?.status === 'started' && result.data.tournamentId) {
        joinedTournament = result.data.tournamentId;
        try { sessionStorage.setItem('current_tournament_id', result.data.tournamentId); } catch {}
        await goto(`/game/tournament/${result.data.tournamentId}`);
        return;
      }

      info = 'Waiting for 4 players...';
    } catch (err) {
      console.error('joinTournament error:', err);
      error = 'Network error or backend unreachable.';
      waiting = false;
    }
  }

  function cancel() {
    waiting = false;
    info = '';
    disconnectGameSocket();
  }

  onDestroy(() => {
    if (!joinedTournament) disconnectGameSocket();
  });
</script>

<svelte:head>
  <title>Tournament</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">
  <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-6">
    Remote Tournament
  </h1>

  {#if error}
    <div class="mb-4 rounded bg-red-500/20 border border-red-300/30 px-4 py-3 text-red-100">{error}</div>
  {/if}

  {#if !waiting}
    <p class="text-center text-blue-100 mb-4">4 joueurs · bracket à élimination directe</p>
    <div class="flex justify-center p-4">
      <button
        type="button"
        onclick={joinTournament}
        class="px-8 py-4 rounded bg-gray-500/25 hover:bg-gray-400/35 border border-white/20 text-blue-100 font-semibold transition"
      >
        Rejoindre le tournoi
      </button>
    </div>
  {:else}
    <div class="text-center py-8">
      <p class="text-blue-100 mb-4">{info}</p>
      <div class="inline-block animate-spin h-8 w-8 border-4 border-pink-200 border-t-transparent rounded-full mb-4"></div>
      <div>
        <button
          type="button"
          onclick={cancel}
          class="mt-4 px-6 py-3 rounded bg-white/20 hover:bg-white/30 border border-white/20 text-blue-100 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}
</div>
