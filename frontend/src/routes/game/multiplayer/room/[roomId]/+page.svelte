<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getGameSocket, disconnectGameSocket, ensureGameSocketConnected } from '$lib/shared/gameSocket';

  type RoomPlayer = { id: string; nickname: string; isReady: boolean };

  const roomId = $derived(page.params.roomId);

  let players = $state<RoomPlayer[]>([]);
  let myReady = $state(false);
  let readyBusy = $state(false);
  let error = $state('');
  let starting = $state(false);
  let leaving = false;
  let inTournament = $state(false);

  function attachListeners() {
    const socket = getGameSocket();

    socket.off('player_ready');
    socket.off('game_started');
    socket.off('player_left');
    socket.off('session_reconnect');
    socket.off('error');
    socket.on('session_reconnect', async (payload: any) => {
      if ((payload.type === 'in_room' || payload.type === 'matched') && payload.roomId === roomId) {
        console.log(`socket id: ${socket.id}`);
        console.log('payload type: ', payload.type);
        players = (payload.players ?? []).map((p: any) => ({
          id: p.id ?? p.userId,
          nickname: p.nickname,
          isReady: p.isReady ?? false,
        }));
        // try to sync myReady from server state
        try {
          const resp = await fetch('/api/user/me', { credentials: 'include' });
          if (resp.ok) {
            const me = await resp.json();
            const meId = String(me.data?.id ?? me.id ?? '');
            const mePlayer = players.find(p => String(p.id) === meId);
            if (mePlayer) myReady = !!mePlayer.isReady;
          }
        } catch {}
      } else if (payload.type === 'in_game' && payload.gameId) {
        starting = true;
        goto(`/game/multiplayer/play/${payload.gameId}`);
      }
    });

    socket.on('player_ready', (payload: { playerId: string; isReady: boolean; allReady: boolean }) => {
      const pid = String(payload.playerId);
      players = players.map(p => String(p.id) === pid ? { ...p, isReady: payload.isReady } : p);
    });

    socket.on('game_started', (payload: { gameId: string; firstQuestion: any; players: any; startedAt?: number }) => {
      starting = true;
      try {
        sessionStorage.setItem('mp_first_question', JSON.stringify({ gameId: payload.gameId, question: payload.firstQuestion, players: payload.players, startedAt: payload.startedAt }));
      } catch {}
      goto(`/game/multiplayer/play/${payload.gameId}`);
    });

    socket.on('player_left', (payload: { playerId: string; newHostId: string }) => {
      const pid = String(payload.playerId);
      players = players.filter(p => String(p.id) !== pid);
    });

    socket.on('error', (payload: { message: string }) => {
      error = payload.message ?? 'Socket error';
    });
  }

async function toggleReady() {
    if (readyBusy) return;
    readyBusy = true;
    const next = !myReady;
    error = '';
    try {
      const response = await fetch(`/api/game/multiplayer/ready/${roomId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReady: next }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        // backend returns success=false with "Waiting for other players" — that's fine
        if (result?.error?.code !== 'Waiting for other players') {
          error = result?.message ?? 'Failed to set ready';
          return;
        }
      }
      myReady = next;
    } catch (err) {
      console.error('toggleReady error:', err);
      error = 'Network error.';
    } finally {
      readyBusy = false;
    }
  }

  onMount(async () => {
    try {
      await ensureGameSocketConnected();
    } catch {}
    attachListeners();
    try { inTournament = !!sessionStorage.getItem('current_tournament_id'); } catch {}
    // load players from sessionStorage (set by next_match_ready)
    try {
      const raw = sessionStorage.getItem('mp_room_players');
      if (raw) {
        const matched = JSON.parse(raw);
        players = matched.map((p: any) => ({ id: p.userId, nickname: p.nickname, isReady: false }));
        sessionStorage.removeItem('mp_room_players');
        // attempt to sync myReady if server already knows
        try {
          const resp = await fetch('/api/user/me', { credentials: 'include' });
          if (resp.ok) {
            const me = await resp.json();
            const meId = String(me.data?.id ?? me.id ?? '');
            const mePlayer = players.find(p => String(p.id) === meId);
            if (mePlayer) myReady = !!mePlayer.isReady;
          }
        } catch {}
      }
    } catch {}
  });

  onDestroy(() => {
    let inTournament = false;
    try { inTournament = !!sessionStorage.getItem('current_tournament_id'); } catch {}
    if (!starting && !inTournament) {
      // user navigated away mid-lobby
      disconnectGameSocket();
    }
  });
</script>

<svelte:head>
  <title>Room {roomId}</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">
  <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-2">
    {inTournament ? 'Tournament Match' : 'Lobby'}
  </h1>
  <p class="text-center text-sm text-blue-100/80 mb-6">Room {roomId}</p>

  {#if error}
    <div class="mb-4 rounded bg-red-500/20 border border-red-300/30 px-4 py-3 text-red-100">
      {error}
    </div>
  {/if}

  <div class="grid gap-3 p-4">
    {#each players as p}
      <div class="flex items-center justify-between px-4 py-3 rounded bg-gray-500/25 border border-white/20">
        <span class="text-blue-100">{p.nickname}</span>
        <span class={p.isReady ? 'text-green-300' : 'text-pink-200/70'}>
          {p.isReady ? 'Ready' : 'Not ready'}
        </span>
      </div>
    {:else}
      <p class="text-center text-blue-100/70">Joining room...</p>
    {/each}
  </div>

  <div class="flex justify-center mt-6">
    <button
      type="button"
      onclick={toggleReady}
      disabled={readyBusy || starting}
      class="px-6 py-3 rounded bg-white/20 hover:bg-white/30 border border-white/20 text-blue-100 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {myReady ? 'Cancel ready' : 'Ready'}
    </button>
  </div>
</div>
