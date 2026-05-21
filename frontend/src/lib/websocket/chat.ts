import { io } from "socket.io-client";

let instance: ReturnType<typeof createWS> | null = null

function createWS() {

	const socket = io('/chat', {
		withCredentials: true,
        reconnection: true,
    });

	socket.on('connect', () => {
      console.log(`✅ chat WS connected, id: ${socket.id}`);
    });

    socket.on('connect_error', (err) => {
        console.log(`❌ chat WS connect_error: ${err.message}`);
    });

    socket.onAny((event, ...args) => {
        console.log(`📨 event: ${event}`, JSON.stringify(args));
    });

	return {
		socket,
		sendMessage: (toUserId: string, content: string) =>
			socket.emit('send_message', { toUserId, content }),
		getHistory: (withUserId: string) =>
			socket.emit('get_history', { withUserId }),
		markRead: (fromUserId: string) =>
			socket.emit('mark_read', { fromUserId }),
	};
}

export function connectWS() {
	if (!instance)
		instance = createWS();
	return instance;
}