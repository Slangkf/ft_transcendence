import { io, type Socket } from 'socket.io-client';

// Singleton socket instance shared across the application
let socket: Socket | null = null;

/**
 * Returns the active game socket instance.
 * Reuses the existing socket if already connected,
 * otherwise creates and initializes a new connection.
 */
export function getGameSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    return socket;
  }
  socket = io('/game', {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
  return socket;
}


/**
 * Disconnects the current game socket
 * and clears the singleton instance.
 */
export function disconnectGameSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
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
