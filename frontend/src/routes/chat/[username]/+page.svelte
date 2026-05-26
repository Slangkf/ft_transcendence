<script lang="ts">
	import { page } from '$app/state'
	import { onMount, onDestroy } from 'svelte'
	import { connectWS } from '$lib/websocket/chat';
	import { resetUnread } from '$lib/stores/unread'
	
	const { data } = $props();
	const { socket, getHistory, sendMessage, markRead } = connectWS();

	// Get the target user's ID from the URL query parameter.
	const selectedUserId = page.url.searchParams.get('with');

	let messages = $state<any[]>([]);
	let	inputContent = $state('');
	let messageContainer = $state<HTMLElement | null>(null);
	let messageReceivedWrapper: (data: any) => void;

	/*
	* Runs once on mount:
	* - Loads chat history and resets the unread count for the active conversation.
	* - Listens for incoming and sent messages to update the message list.
	* - Emits get_history once the socket is connected.
	*/
	onMount(() => {
		socket.on('history', (data) => {
			messages = data.message.reverse();
			if (selectedUserId) resetUnread(selectedUserId), markRead(selectedUserId);
		});

		messageReceivedWrapper = (data) => { 
			messages = [...messages, data];
		}
		socket.on('message_received', messageReceivedWrapper);

		socket.on('message_send', (data) => {
			messages = [...messages, data];
		});

		if (socket.connected && selectedUserId) {
			getHistory(selectedUserId);
		} else {
			socket.once('connect', () => {
				if (selectedUserId) getHistory(selectedUserId);
			});
		}
	});

	// Removes event listeners when the component is destroyed.
	onDestroy(() => {
		socket.off('history');
		socket.off('message_received', messageReceivedWrapper);
		socket.off('message_send');
	});

	// Sends the current input content as a message to the selected user.
	async function handleSentMessages() {
		if (!selectedUserId)
			return;
		if (inputContent) {
			sendMessage(selectedUserId, inputContent);
			inputContent = '';
		}
		return;
	}

	// Formats a timestamp: shows time only if today, otherwise shows date and time.
	function dateFormat(createdAt: string): string {
		const date = new Date(createdAt);
		const isToday = date.toDateString() === new Date().toDateString();

		return isToday
			? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
			: date.toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	}

	// Scrolls to the bottom of the chat container whenever messages update.
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
	
    <!-- Input shield -->
    <div class="flex items-center w-full px-6 py-4 mt-4 rounded-xl gap-3">
        <input onkeydown={(e) => e.key === 'Enter' && handleSentMessages()} bind:value={inputContent} type="text" placeholder="Write a message" class="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"/>
        <button onclick={() => handleSentMessages()} class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500">Send</button>
    </div>
</div>
