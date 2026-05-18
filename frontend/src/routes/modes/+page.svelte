<script lang="ts">
	import "../../app.css";
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/toast.svelte';
	import { onMount } from 'svelte'
	import { page } from '$app/state';

	onMount(() => {
		page.url.searchParams.get('register') && showToast("Registration successful. Welcome!");
		page.url.searchParams.get('login') && showToast("Connection successful, welcome back!");
	});

	async function handleGameMode(_mode: string) {
		await goto('/game/categories');
	}

	async function handleMultiplayer() {
		await goto('/game/multiplayer');
	}

	async function handleTournament() {
		await goto('/game/tournament');
	}
</script>

<!-- Container -->
<div class="pb-25">
	<!-- Main card -->
	<div class="w-full max-w-5xl rounded-xl px-4 py-4 bg-slate-900/60 backdrop-blur-xs">
		<!-- Title -->
		<h2 class="text-2xl font-semibold text-pink-500 text-center">Game</h2>
		<p class="mt-1 text-pink-500 text-center">Choose your mode</p>
		<!-- Mode cards -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-2 w-full">
			<!-- Solo button -->
			<button onclick={() => handleGameMode("solo")} class="flex flex-col items-center cursor-pointer overflow-hidden rounded-xl transition transform duration-200 hover:scale-105 hover:drop-shadow-[10px_10px_15px_#3B82F6] text-pink-500 hover:text-blue-500">
				<img src="/images/solo_mode.png" alt="solo mode" class="w-full max-w-180px h-auto object-cover">
				<p class="text-sm font-semibold text-center">Practice</p>
			</button>
			<!-- Versus IA button -->
			<button disabled class="flex flex-col items-center cursor-not-allowed opacity-50 overflow-hidden rounded-xl transition transform duration-200 text-pink-500">
				<img src="/images/versus_mode.png" alt="versus mode" class="w-full max-w-180px h-auto object-cover">
				<p class="text-sm font-semibold text-center">Versus AI</p>
			</button>
			<!-- Multiplayer button -->
			<button onclick={handleMultiplayer} class="flex flex-col items-center cursor-pointer overflow-hidden rounded-xl transition transform duration-200 hover:scale-105 hover:drop-shadow-[10px_10px_15px_#3B82F6] text-pink-500 hover:text-blue-500">
				<img src="/images/multiplayer_mode.png" alt="multiplayer mode" class="w-full max-w-180px h-auto object-cover">
				<p class="text-sm font-semibold text-center">Online multiplayer</p>
			</button>
			<!-- Tournament button -->
			<button onclick={handleTournament} class="flex flex-col items-center cursor-pointer overflow-hidden rounded-xl transition transform duration-200 hover:scale-105 hover:drop-shadow-[10px_10px_15px_#3B82F6] text-pink-500 hover:text-blue-500">
				<img src="/images/tournament_mode.png" alt="tournament mode" class="w-full max-w-180px h-auto object-cover">
				<p class="text-sm font-semibold text-center">Remote tournament</p>
			</button>
		</div>
	</div>
</div>