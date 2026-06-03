<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getGameSocket, disconnectGameSocket, ensureGameSocketConnected } from '$lib/shared/gameSocket';

  type MatchPlayer = { userId: string; nickname: string };
  type StartApiResponse = {
    success: boolean;
    message: string;
    data: any;
  };

  const sizes = [2, 3, 4];

  let selectedSize = $state<number | null>(null);
  let waiting = $state(false);
  let error = $state('');
  let info = $state('');
  let matchedRoomId: string | null = null;

  async function ensureSocketConnected(): Promise<void> {
    await ensureGameSocketConnected();
  }

  function setupSocketListeners() {
    const socket = getGameSocket();

    socket.off('matched');
    socket.off('session_reconnect');
    socket.off('error');

    socket.on('matched', (payload: { roomId: string; players: MatchPlayer[] }) => {
      matchedRoomId = payload.roomId;
      try { sessionStorage.setItem('mp_room_players', JSON.stringify(payload.players)); } catch {}
      goto(`/game/multiplayer/room/${payload.roomId}`);
    });

    socket.on('session_reconnect', (payload: any) => {
      if (payload.type === 'queue') {
        waiting = true;
        info = 'Waiting for players...';
      } else if (payload.type === 'matched' && payload.roomId) {
        matchedRoomId = payload.roomId;
        goto(`/game/multiplayer/room/${payload.roomId}`);
      }
    });

    socket.on('error', (payload: { message: string }) => {
      error = payload.message ?? 'Socket error';
    });
  }

  onMount(() => {
    // surface a notice if we were just bounced here (e.g. readiness timeout)
    try {
      const notice = sessionStorage.getItem('mp_notice');
      if (notice) { error = notice; sessionStorage.removeItem('mp_notice'); }
    } catch {}

    const socket = getGameSocket();
    if (!socket.connected) socket.connect();
    setupSocketListeners();
  });

  async function joinQueue(size: number) {
    error = '';
    info = '';
    selectedSize = size;
    waiting = true;

    try {
      await ensureSocketConnected();
      setupSocketListeners();
      const response = await fetch('/api/game/multiplayer/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size }),
      });

      let result: StartApiResponse | null = null;
      try {
        result = await response.json();
      } catch {
        error = `Backend error (HTTP ${response.status}).`;
        waiting = false;
        return;
      }

      if (response.status === 401) {
        error = 'You are not logged in. Please log in to play.';
        waiting = false;
        return;
      }

      if (!response.ok || !result?.success) {
        error = result?.message ?? 'Failed to join matchmaking.';
        waiting = false;
        return;
      }

      // status === 'matched' immediately (we filled the queue)
      if (result.data && result.data.status === 'matched' && result.data.roomId) {
        matchedRoomId = result.data.roomId;
        await goto(`/game/multiplayer/room/${result.data.roomId}`);
        return;
      }

      // status === 'waiting' — keep socket open
      info = `Waiting for ${size} players...`;
    } catch (err) {
      console.error('joinQueue error:', err);
      error = 'Network error or backend unreachable.';
      waiting = false;
    }
  }

  async function cancel() {
    waiting = false;
    selectedSize = null;
    info = '';
    disconnectGameSocket();
  }

  onDestroy(() => {
    if (!matchedRoomId) {
      // user navigated away without being matched — drop the socket
      disconnectGameSocket();
    }
  });
</script>

<svelte:head>
  <title>Multiplayer</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">
  <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-6">
    Online Multiplayer
  </h1>

  {#if error}
    <div class="mb-4 rounded bg-red-500/20 border border-red-300/30 px-4 py-3 text-red-100">
      {error}
    </div>
  {/if}

  {#if !waiting}
    <p class="text-center text-blue-100 mb-4">How many players?</p>
    <div class="grid gap-3 p-4 sm:grid-cols-3">
      {#each sizes as size}
        <button
          type="button"
          onclick={() => joinQueue(size)}
          class="px-6 py-4 rounded bg-gray-500/25 hover:bg-gray-400/35 border border-white/20 text-blue-100 font-semibold transition"
        >
          {size} players
        </button>
      {/each}
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
