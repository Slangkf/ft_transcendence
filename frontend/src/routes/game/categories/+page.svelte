<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  const mode = $derived(
  	page.url.searchParams.get('mode') ?? 'solo'
  );

  type CategoriesApiResponse = {
    success: boolean;
    message: string;
    data: string[] | null;
  };

  let categories = $state<string[]>([]);
  let error = $state('');
  let loading = $state(true);

  onMount(async () => {
    try {
      const response = await fetch('/api/game/categories', {
        method: 'GET',
        credentials: 'include',
      });
      if (response.status === 401) {
        error = 'You are not logged in. Please log in to play.';
        return;
      }
      let result: CategoriesApiResponse | null = null;
      try {
        result = await response.json();
      } catch {
        error = `Backend error (HTTP ${response.status}).`;
        return;
      }
      if (!response.ok || !result?.success || !result.data) {
        error = result?.message ?? 'Unable to load categories.';
        return;
      }
      categories = result.data;
    } catch (err) {
      console.error('categories error:', err);
      error = 'Network error or inaccessible server.';
    } finally {
      loading = false;
    }
  });

  async function pickCategory(category: string) {
    await goto(`/game?mode=${mode}&category=${encodeURIComponent(category)}`);
  }

  async function pickRandom() {
    await goto(`/game?mode=${mode}&autostart=true`);
  }
</script>

<svelte:head>
  <title>Choose a category</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6 leading-relaxed font-serif text-blue-200 bg-white/15 backdrop-blur-xs rounded">
  <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-pink-200 text-center mb-6">
    Choose a category
  </h1>

  {#if loading}
    <p class="text-center text-blue-100">Loading categories...</p>
  {:else if error}
    <div class="mb-4 rounded bg-red-500/20 border border-red-300/30 px-4 py-3 text-red-100">
      {error}
    </div>
  {:else}
    <div class="grid gap-3 p-4 sm:grid-cols-2">
      {#each categories as category}
        <button
          type="button"
          onclick={() => pickCategory(category)}
          class="w-full text-center px-4 py-3 rounded bg-gray-500/25 hover:bg-gray-400/35 border border-white/20 text-blue-100 transition"
        >
          {category}
        </button>
      {/each}
    </div>

    <div class="flex justify-center mt-6">
      <button
        type="button"
        onclick={pickRandom}
        class="px-6 py-3 rounded bg-white/20 hover:bg-white/30 border border-white/20 text-blue-100 font-semibold transition"
      >
        Random (any category)
      </button>
    </div>
  {/if}
</div>