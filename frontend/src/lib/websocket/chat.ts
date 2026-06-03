import { io } from "socket.io-client";

// Holds the singleton instance of the chat WebSocket connection.
let instance: ReturnType<typeof createWS> | null = null

/*
 * Creates and returns the chat WebSocket connection to the /chat namespace.
 * Implemented as a singleton because both the layout (unread badge logic) and
 * the chat page (history, messages) share the same connection. Without it,
 * multiple connections would cause duplicate events.
 * - Logs connection status and errors.
 * - Exposes helper functions for common chat events.
 */
function createWS() {

	const socket = io('/chat', {
		withCredentials: true,
        reconnection: true,
    });

	// socket.on('connect', () => {
    //   console.log(`✅ chat WS connected, id: ${socket.id}`);
    // });

    // socket.on('connect_error', (err) => {
    //     console.log(`❌ chat WS connect_error: ${err.message}`);
	// 	console.trace();
    // });

    // socket.onAny((event, ...args) => {
    //     console.log(`📨 event: ${event}`, JSON.stringify(args));
    // });

	return {
		socket,
		getHistory: (withUserId: string) =>
			socket.emit('get_history', { withUserId }),
		sendMessage: (receiverId: string, content: string) =>
			socket.emit('send_message', { receiverId, content }),
		markRead: (senderId: string) =>
			socket.emit('mark_read', { senderId }),
	};
}

// Returns the existing instance or creates a new one (singleton pattern).
export function connectWS() {
	if (!instance)
		instance = createWS();
	return instance;
}

// Disconnects the chat WebSocket and resets the singleton instance.
export function disconnectWS() {
    instance?.socket.disconnect();
    instance = null;
}
