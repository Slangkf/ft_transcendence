<script lang="ts">
	import "../../app.css";
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	async function handleGameMode(mode: "solo" | "IA" | "tournament" | "multiplayer") {
    	try {
    		const response = await fetch('/api/game', {
        		method: 'POST',
				headers: {'Content-Type': 'application/json' },
				body: JSON.stringify({ mode })
      		});
			if (!response.ok) {
				console.error("DAMMMN")
				return;
			}
			const result = await response.json();
			console.log(result);
			await goto('/game'); // Check the backend's return
		}
		catch (error) {
			console.error('Game mode page error:', error);
    	}
  	}
</script>

<!-- Main card -->
<div class="w-full max-w-5xl rounded-xl px-4 py-4 bg-slate-900/60 backdrop-blur-xs">
	<!-- Title -->
	<h2 class="text-2xl font-semibold text-pink-500 text-center">Game</h2>
	<p class="mt-1 text-pink-500 text-center">Choose your mode</p>
	<!-- Mode cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2 pb-2 w-full">
		<!-- Solo button -->
		<button onclick={() => handleGameMode("solo")} class="flex flex-col items-center cursor-pointer overflow-hidden rounded-xl transition transform duration-200 hover:scale-105 hover:drop-shadow-[10px_10px_15px_#3B82F6] text-pink-500 hover:text-blue-500">
			<img src="/images/solo_mode.png" alt="solo mode" class="w-full max-w-180px h-auto object-cover">
			<p class="text-sm font-semibold text-center">Practice</p>
		</button>
		<!-- Versus IA button -->
		<button onclick={() => handleGameMode("IA")} class="flex flex-col items-center cursor-pointer overflow-hidden rounded-xl transition transform duration-200 hover:scale-105 hover:drop-shadow-[10px_10px_15px_#3B82F6] text-pink-500 hover:text-blue-500">
			<img src="/images/versus_mode.png" alt="versus mode" class="w-full max-w-180px h-auto object-cover">
			<p class="text-sm font-semibold text-center">Versus AI</p>
		</button>
		<!-- Multiplayer button -->
		<button onclick={() => handleGameMode("multiplayer")} class="flex flex-col items-center cursor-pointer overflow-hidden rounded-xl transition transform duration-200 hover:scale-105 hover:drop-shadow-[10px_10px_15px_#3B82F6] text-pink-500 hover:text-blue-500">
			<img src="/images/multiplayer_mode.png" alt="multiplayer mode" class="w-full max-w-180px h-auto object-cover">
			<p class="text-sm font-semibold text-center">Online multiplayer</p>
		</button>
		<!-- Tournament button -->
		<button onclick={() => handleGameMode("tournament")} class="flex flex-col items-center cursor-pointer overflow-hidden rounded-xl transition transform duration-200 hover:scale-105 hover:drop-shadow-[10px_10px_15px_#3B82F6] text-pink-500 hover:text-blue-500">
			<img src="/images/tournament_mode.png" alt="multiplayer mode" class="w-full max-w-180px h-auto object-cover">
			<p class="text-sm font-semibold text-center">Local tournament</p>
		</button>
	</div>
</div>
