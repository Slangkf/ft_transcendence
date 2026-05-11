import { io } from "socket.io-client";
import { showToast } from "$lib/toast.svelte";
  
export function connectWS() {

	const socket = io('https://localhost:8888/friendship', {
		withCredentials: true,
		transports: ['polling']
    });

	socket.on('connect', () => {
      console.log(`✅ friendship WS connected, id: ${socket.id}`);
    });

    socket.on('connect_error', (err) => {
        console.log(`❌ connect_error: ${err.message}`);
    });

    socket.onAny((event, ...args) => {
        console.log(`📨 event: ${event}`, JSON.stringify(args));
    });

	socket.on('friend_request', (data) => {
		showToast(`${data.fromNickname} sent you a friend request`);
    });

	socket.on('friend_accept', (data) => {
		showToast(`${data.nickname} accepted your friend request`);
    });

	// socket.on('friend_online', (data) => {
	// 	showToast(`${data.fromNickname} is online`);
    // });

	// socket.on('friend_offline', (data) => {
	// 	showToast(`${data.nickname} is offline`);
    // });

	return socket;
}
