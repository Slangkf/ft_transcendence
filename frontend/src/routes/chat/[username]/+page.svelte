<script lang="ts">
	import { page } from '$app/state'
	import { onMount } from 'svelte'
	import { connectWS } from '$lib/websocket/chat';
	
	const { data } = $props();
	const selectedUserId = page.url.searchParams.get('with');
	const { socket, sendMessage, getHistory } = connectWS();

	let messages = $state<any[]>([]);
	let	inputContent = $state('');

	onMount(() => {
		socket.on('history', (data) => {
		console.log('history', data.message);
			messages = data.message;
		});

		socket.on('message_received', (data) => {
			console.log('message_received', data);
			messages = [...messages, data];
		});

		socket.on('message_send', (data) => {
			console.log('message_send', data);
			messages = [...messages, data];
		});

		if (selectedUserId) {
            getHistory(selectedUserId);
        }
	});

	async function handleSentMessages() {
		if (!selectedUserId)
			return;
		sendMessage(selectedUserId, inputContent);
		inputContent = '';
	}

	console.log('User object', data.user);
</script>

<!-- Main card -->
<div class="flex flex-col items-center justify-center w-full max-w-200 rounded-xl p-4 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
	<!-- Main card title -->
	<h2 class="text-2xl font-semibold text-pink-500 text-center">Chat</h2>
	<p class="mt-1 text-pink-500 text-center">Your chat with</p>
	
    <!-- Message zone -->
    <div class="flex flex-col w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-8 rounded-xl h-200 overflow-y-auto gap-3">
        <!-- Message history -->
		{#each messages as message}
			<div class="flex {message.senderId === data.user?.id ? 'justify-end' : 'justify-start'} w-full">
				<div class="px-4 py-2 rounded-xl max-w-xs {message.senderId === data.user?.id ? 'bg-blue-500' : 'bg-slate-700'}">
					{message.content}
				</div>
			</div>
		{:else}
			<!-- Empty chat message -->
				<p class="flex items-center justify-center text-pink-500 font-medium">No message</p>
		{/each}
    </div>
	
    <!-- Input zone -->
    <div class="flex items-center w-full px-6 py-4 mt-4 rounded-xl gap-3">
        <input bind:value={inputContent} type="text" placeholder="Write a message" class="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-500"/>
        <button onclick={handleSentMessages} class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500">Send</button>
    </div>
</div>
