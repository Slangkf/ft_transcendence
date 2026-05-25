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
