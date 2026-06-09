<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getGameSocket, disconnectGameSocket, ensureGameSocketConnected } from '$lib/shared/gameSocket';

  type RoomPlayer = { id: string; nickname: string; isReady: boolean };

  const roomId = $derived(page.params.roomId);

  let players = $state<RoomPlayer[]>([]);
  let myUserId = $state('');
  let myReady = $state(false);
  let readyBusy = $state(false);
  let error = $state('');
  let starting = $state(false);
  let leaving = false;
  let inTournament = $state(false);

  // Readiness countdown (server-authoritative; this is just the visible mirror).
  // If players don't all ready up before it hits 0 the backend resolves the
  // lobby and emits `ready_timeout`.
  const READY_SECONDS = 60;
  let readyCountdown = $state(READY_SECONDS);
  let readyTick: ReturnType<typeof setInterval> | null = null;

  function stopReadyCountdown() {
    if (readyTick) { clearInterval(readyTick); readyTick = null; }
  }

  function attachListeners() {
    const socket = getGameSocket();

    socket.off('player_ready');
    socket.off('game_started');
    socket.off('player_left');
    socket.off('session_reconnect');
    socket.off('ready_timeout');
    socket.off('error');

    socket.on('ready_timeout', (payload: { roomId: string; excluded: boolean }) => {
      console.log('[TOURNEY-CLIENT] ready_timeout received', payload, '-> going back to bracket');
      console.log(`[JUMP-CLI] room got ready_timeout room=${payload.roomId?.slice(0, 8)} excluded=${payload.excluded} me=${myUserId} (mine=${roomId?.slice(0, 8)})${payload.roomId !== roomId ? ' -> IGNORED (other room)' : ' -> back to bracket'}`);
      if (payload.roomId !== roomId) return;
      stopReadyCountdown();
      starting = true; // suppress the "navigated away mid-lobby" disconnect for tournaments
      let tid: string | null = null;
      try { tid = sessionStorage.getItem('current_tournament_id'); } catch {}
      if (tid) {
        // tournament: back to the bracket (advancing / eliminated / final ranking)
        goto(`/game/tournament/${tid}`);
      } else {
        // plain multiplayer: the match is cancelled — back to the menu with a notice
        try {
          sessionStorage.setItem('mp_notice', payload.excluded
            ? "You have been excluded: you did not declare yourself ready in time."
            : "Game cancelled: a player did not declare themselves ready in time.");
          sessionStorage.removeItem('mp_room_players');
        } catch {}
        goto('/game/multiplayer');
      }
    });
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
        console.log(`[JUMP-CLI] room got session_reconnect in_game game=${payload.gameId?.slice(0, 8)} me=${myUserId} -> JUMP to play page`);
        starting = true;
        stopReadyCountdown();
        goto(`/game/multiplayer/play/${payload.gameId}`);
      }
    });

    socket.on('player_ready', (payload: { playerId: string; isReady: boolean; allReady: boolean }) => {
      const pid = String(payload.playerId);
      players = players.map(p => String(p.id) === pid ? { ...p, isReady: payload.isReady } : p);
    });

    socket.on('game_started', (payload: { gameId: string; firstQuestion: any; players: any; startedAt?: number; totalQuestions?: number }) => {
      // Only act on the game start I'm actually part of. The /game socket is a shared
      // singleton joined to the tournament room and to BOTH semi rooms over a session;
      // game_started carries no roomId, so without this check a start meant for the
      // OTHER match (or a leaked handler from a previous room) would drag this player
      // onto the wrong game. Eliminated/non-participants are never in `players`.
      const iAmIn = !!myUserId && !!payload.players && (
        Array.isArray(payload.players)
          ? payload.players.some((p: any) => String(p.id ?? p.userId) === myUserId)
          : !!payload.players[myUserId]
      );
      console.log(`[JUMP-CLI] room got game_started game=${payload.gameId?.slice(0, 8)} iAmIn=${iAmIn} me=${myUserId} (mine=${roomId?.slice(0, 8)})${iAmIn ? ' -> JUMP to play' : ' -> IGNORED (not a participant)'}`);
      if (!iAmIn) return;
      console.log('[TOURNEY-CLIENT] game_started received game=', payload.gameId, '-> going to play page');
      starting = true;
      stopReadyCountdown();
      try {
        sessionStorage.setItem('mp_first_question', JSON.stringify({ gameId: payload.gameId, question: payload.firstQuestion, players: payload.players, startedAt: payload.startedAt, totalQuestions: payload.totalQuestions }));
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
    // Resolve my user id early so the game_started participation guard works.
    try {
      const r = await fetch('/api/user/me', { credentials: 'include' });
      if (r.ok) {
        const me = await r.json();
        myUserId = String(me.data?.id ?? me.id ?? '');
      }
    } catch {}
    try {
      await ensureGameSocketConnected();
    } catch {}
    const sock = getGameSocket();
    console.log('[TOURNEY-CLIENT] room page mounted roomId=', roomId, 'socket.id=', sock.id, 'connected=', sock.connected);
    console.log(`[JUMP-CLI] room page MOUNT room=${roomId?.slice(0, 8)} me=${myUserId} inTournament=${(() => { try { return !!sessionStorage.getItem('current_tournament_id'); } catch { return false; } })()}`);
    attachListeners();
    try { inTournament = !!sessionStorage.getItem('current_tournament_id'); } catch {}
    // We've reached a room, so the "pending room" hint that routed us here has
    // done its job. Clear it now: otherwise it lingers as a stale roomId and,
    // when this match ends and we return to the bracket, bounces us back into
    // this now-finished room (the "ready / not ready" screen) instead of letting
    // the bracket show the spectator view / next match.
    try { sessionStorage.removeItem('tournament_pending_room'); } catch {}

    // mirror the server-side readiness deadline
    readyCountdown = READY_SECONDS;
    readyTick = setInterval(() => {
      if (readyCountdown > 0) readyCountdown -= 1;
      else stopReadyCountdown();
    }, 1000);

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
    stopReadyCountdown();
    // Drop this page's handlers from the shared singleton socket so they don't keep
    // firing (notably the unguarded game_started) once we're on the play/bracket page.
    try {
      const s = getGameSocket();
      s.off('ready_timeout');
      s.off('session_reconnect');
      s.off('player_ready');
      s.off('game_started');
      s.off('player_left');
      s.off('error');
    } catch {}
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

  {#if !starting}
    <p class="text-center mb-4">
      <span class="text-blue-100/80 text-sm">Everyone needs to be ready — </span>
      <span class="inline-block font-mono text-lg font-bold {readyCountdown <= 3 ? 'text-red-300 animate-pulse' : readyCountdown <= 5 ? 'text-yellow-200' : 'text-blue-100/90'}">
        {readyCountdown}s
      </span>
      <span class="block text-xs text-blue-100/50 mt-1">
        {inTournament
          ? "If there is no response, you forfeit the match."
          : "If there is no response, the game is cancelled."}
      </span>
    </p>
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
