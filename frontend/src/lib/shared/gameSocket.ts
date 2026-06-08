import { io, type Socket } from 'socket.io-client';

// Singleton socket instance shared across the application
let socket: Socket | null = null;
// DIAGNOSTIC: how many times THIS tab actually created a /game connection. It must
// stay at 1 for a tab's whole lifetime. If the console shows #2, #3… we have the
// double-connect that appears server-side as "2 sockets / account" + churn.
let createCount = 0;

/**
 * Returns the active game socket instance.
 * Strict singleton: reuse the existing instance whatever its state (connected,
 * connecting, reconnecting). Creating a new io() while the previous one is still
 * mid-handshake spawns a SECOND server-side socket (a zombie that lingers in the
 * match rooms) — the root of the "a player is stuck / jumps" symptom.
 */
export function getGameSocket(): Socket {
  if (socket) return socket;
  createCount += 1;
  console.log(`[TOURNEY-CLIENT] getGameSocket: CREATE /game socket #${createCount}`);
  socket = io('/game', {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
  socket.on('connect', () => console.log(`[TOURNEY-CLIENT] /game CONNECT id=${socket?.id} (create#${createCount})`));
  socket.on('disconnect', (reason) => console.log(`[TOURNEY-CLIENT] /game DISCONNECT reason=${reason}`));
  socket.on('connect_error', (err) => console.log(`[TOURNEY-CLIENT] /game CONNECT_ERROR ${err?.message ?? err}`));
  return socket;
}


/**
 * Intentional NO-OP. The /game socket is a per-tab singleton that must live for the
 * whole session. Tearing it down on navigation is what produced the churn we saw in
 * the client console: `DISCONNECT reason=io client disconnect` → a fresh socket #2/#3
 * created on the next page, while the OLD socket lingered server-side inside the match
 * room. Room membership and targeted events then split across two sockets, and a player
 * (deterministically the bracket-derived one) ended up stuck on the bracket, unable to
 * play. The connection closes naturally on full page reload / logout. To LEAVE a
 * tournament, call the backend /api/tournament/leave endpoint — not this.
 */
export function disconnectGameSocket() {
  /* no-op on purpose — keep the singleton alive across navigation */
}

export async function ensureGameSocketConnected(): Promise<void> {
  const s = getGameSocket();
  if (s.connected) return;
  await new Promise<void>((resolve, reject) => {
    const onConnect = () => { cleanup(); resolve(); };
    const onErr = (err: any) => { cleanup(); reject(err); };
    const cleanup = () => { s.off('connect', onConnect); s.off('connect_error', onErr); };
    s.once('connect', onConnect);
    s.once('connect_error', onErr);
    if (!s.active) s.connect();
  });
}
