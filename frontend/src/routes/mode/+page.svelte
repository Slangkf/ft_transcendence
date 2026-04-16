<script lang="ts">
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>Mode de jeu</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-12">
  <h1 class="text-2xl sm:text-3xl md:text-4xl font-bold text-pink-200 text-center mb-12 drop-shadow-[0_0_10px_blue]">
    Choisir un mode
  </h1>

  <div class="grid gap-6">

    <!-- Solo -->
    <button
      type="button"
      onclick={() => goto('/game?mode=solo')}
      class="group flex flex-col items-center gap-2 px-8 py-6 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 hover:border-pink-400/50 text-blue-100 transition cursor-pointer"
    >
      <span class="text-xl font-bold text-pink-200 group-hover:drop-shadow-[0_0_8px_#FF1D8D]">Solo</span>
      <span class="text-sm text-blue-200/70">Joue seul contre le quiz</span>
    </button>

    <!-- Multijoueur -->
    <div class="relative flex flex-col items-center gap-2 px-8 py-6 rounded-lg bg-white/5 border border-white/10 text-blue-100/40 cursor-not-allowed">
      <span class="text-xl font-bold">Multijoueur</span>
      <span class="text-sm">Affronte d'autres joueurs en temps réel</span>
      <span class="absolute top-3 right-4 text-xs font-semibold text-pink-400/70 border border-pink-400/30 rounded px-2 py-0.5">
        Bientôt disponible
      </span>
    </div>

    <!-- vs IA -->
    <div class="relative flex flex-col items-center gap-2 px-8 py-6 rounded-lg bg-white/5 border border-white/10 text-blue-100/40 cursor-not-allowed">
      <span class="text-xl font-bold">vs IA</span>
      <span class="text-sm">Défie une intelligence artificielle</span>
      <span class="absolute top-3 right-4 text-xs font-semibold text-pink-400/70 border border-pink-400/30 rounded px-2 py-0.5">
        Bientôt disponible
      </span>
    </div>

  </div>
</div>
