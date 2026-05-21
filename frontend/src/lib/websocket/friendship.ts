import { io, Socket } from "socket.io-client";
import { showToast } from "$lib/shared/toast.svelte";
import type { FriendSocketEvents } from "$lib/shared/socket.types";

export function connectWS(): Socket<FriendSocketEvents> {

	const socket = io('/friendship', {
		withCredentials: true,
        reconnection: true,
    });

	socket.on('connect', () => {
      console.log(`✅ friendship WS connected, id: ${socket.id}`);
    });

    socket.on('connect_error', (err) => {
        console.log(`❌ friendship WS connect_error: ${err.message}`);
    });

    socket.onAny((event, ...args) => {
        console.log(`📨 event: ${event}`, JSON.stringify(args));
    });

	socket.on('friend_request', (data) => {
		showToast(`${data.fromNickname} sent you a friend request.`);
    });

	socket.on('friend_accept', (data) => {
		showToast(`${data.nickname} has accepted your friend request.`);
    });

	socket.on('friend_online', (data) => { 
		showToast(`${data.nickname} is online`);
    });

	socket.on('friend_offline', (data) => {
		showToast(`${data.nickname} is offline`);
    });

	return socket;
}
