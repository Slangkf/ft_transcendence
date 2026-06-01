<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';

  let progress = $state(0);
  let provider = $state('OAuth');

  onMount(() => {
    const providerParam = page.url.searchParams.get('provider') || 'Google';
    provider = providerParam;

    const start = performance.now();
    const duration = 2000;

    const tick = (now: number) => {
      progress = Math.min((now - start) / duration, 1);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        window.location.href = '/modes/?login=true';
      }
    };
    requestAnimationFrame(tick);
  });
</script>

<div class="sm:pb-50">
  <div class="flex flex-col items-center gap-4 w-full max-w-80 rounded-xl px-6 py-8 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm text-center">

    <span class="text-xs font-medium px-2.5 py-1 rounded-md bg-green-950 text-green-400">
      {provider} OAuth
    </span>

    <div class="w-16 h-16 rounded-full bg-green-950 flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>

    <div>
      <h2 class="text-xl font-semibold text-white">Logged in successfully</h2>
      <p class="mt-1 text-slate-400 text-xs leading-relaxed">
        Your {provider} account has been linked.<br>Redirecting you now…
      </p>
    </div>

    <div class="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
      <div
        class="h-full bg-green-500 rounded-full transition-none"
        style="width: {progress * 100}%"
      ></div>
    </div>

    <p class="text-slate-500 text-xs">Redirecting to /modes in 2s</p>
  </div>
</div>