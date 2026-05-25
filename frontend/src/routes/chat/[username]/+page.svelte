<script lang="ts">
	import { page } from '$app/state'
	import { onMount, onDestroy } from 'svelte'
	import { connectWS } from '$lib/websocket/chat';
	import { incrementUnread, resetUnread } from '$lib/stores/unread'
	
	const { data } = $props();
	const selectedUserId = page.url.searchParams.get('with');
	const { socket, getHistory, sendMessage, markRead } = connectWS();

	let messages = $state<any[]>([]);
	let	inputContent = $state('');
	let messageContainer = $state<HTMLElement | null>(null);
	let messageReceivedWrapper: (data: any) => void;

	onMount(() => {
		socket.on('history', (data) => {
			messages = data.message.reverse();
			if (selectedUserId) resetUnread(selectedUserId), markRead(selectedUserId);
		});

		messageReceivedWrapper = (data) => { 
			console.log('senderId:', data.senderId, 'selectedUserId:', selectedUserId, 'sont différents:', data.senderId !== selectedUserId)
			if (data.senderId !== selectedUserId) incrementUnread(data.senderId);
			messages = [...messages, data];
		}
		socket.on('message_received', messageReceivedWrapper);

		socket.on('message_send', (data) => {
			messages = [...messages, data];
		});

		// getHistory émis seulement une fois connecté
		if (socket.connected && selectedUserId) {
			getHistory(selectedUserId);
		} else {
			socket.once('connect', () => {
				if (selectedUserId) getHistory(selectedUserId);
			});
		}
	});

	// Nettoyage quand le composant est détruit
	onDestroy(() => {
		socket.off('history');
		socket.off('message_received', messageReceivedWrapper);
		socket.off('message_send');
	});

	async function handleSentMessages() {
		if (!selectedUserId)
			return;
		if (inputContent) {
			sendMessage(selectedUserId, inputContent);
			inputContent = '';
		}
		return;
	}

	function dateFormat(createdAt: string): string {
		const date = new Date(createdAt);
		const isToday = date.toDateString() === new Date().toDateString();

		return isToday
			? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
			: date.toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	}

	$effect(() => {
		messages;
		if (messageContainer)
			messageContainer.scrollTop = messageContainer.scrollHeight;
	})
</script>

<!-- Main card -->
<div class="flex flex-col items-center justify-center w-full max-w-200 rounded-xl p-4 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
	<!-- Main card title -->
	<h2 class="text-2xl font-semibold text-pink-500 text-center">Chat</h2>
	<p class="mt-1 text-pink-500 text-center">Your chat with {data.friend?.username}</p>

    <!-- Chat area -->
    <div bind:this={messageContainer} class="flex flex-col w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-8 rounded-xl h-200 overflow-y-auto gap-3">
        <!-- Message container -->
		{#each messages as message}
			<div class="flex w-full {Number(message.receiverId) === data.user?.id ? 'justify-start' : 'justify-end'}">
				<div class= "flex flex-col max-w-xs">
					<span class="text-xs text-slate-400 mb-1 text-center">
						{Number(message.receiverId) === data.user?.id ? data.friend.username : data.user.username}
					</span>
					<div class="px-4 py-2 rounded-xl {Number(message.receiverId) === data.user?.id ? 'bg-pink-500' : 'bg-blue-500'}">
						{message.content}
					</div>
					<span class="text-xs text-slate-400 mt-1 text-center">
						 {dateFormat(message.createdAt)}
					</span>
				</div>
			</div>
		{:else}
			<!-- Empty chat message -->
			<p class="flex items-center justify-center text-pink-500 font-medium">No message</p>
		{/each}
    </div>
	
    <!-- Input bar -->
    <div class="flex items-center w-full px-6 py-4 mt-4 rounded-xl gap-3">
        <input onkeydown={(e) => e.key === 'Enter' && handleSentMessages()} bind:value={inputContent} type="text" placeholder="Write a message" class="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"/>
        <button onclick={() => handleSentMessages()} class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500">Send</button>
    </div>
</div>
