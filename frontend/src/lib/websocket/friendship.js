import { io } from "socket.io-client";
import { showToast } from "$lib/toast.svelte";
  
export function connectWS() {

	const socket = io('https://trans.42.fr/friendship', {
		withCredentials: true,
        reconnection: true,
    });

	socket.on('connect', () => {
      console.log(`✅ friendship WS connected, id: ${socket.id}`);
    });

    socket.on('connect_error', (err) => {
        console.log(`❌ socket connect_error: ${err.message}`);
    });

    socket.onAny((event, ...args) => {
        console.log(`📨 event: ${event}`, JSON.stringify(args));
    });

	socket.on('friend_request', (data) => {
		showToast(`${data.fromNickname} sent you a friend request.`);
    });

	socket.on('friend_accept', (data) => {
		showToast(`${data.nickname} has accepted your friend request.`); //nope
    });

	socket.on('friend_online', (data) => { 
		showToast(`${data.nickname} is online`); //nope
    });

	socket.on('friend_offline', (data) => {
		showToast(`${data.nickname} is offline`); //nope
    });

	return socket;
}
