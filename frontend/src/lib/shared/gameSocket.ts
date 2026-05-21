import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

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

export function disconnectGameSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
