<script lang="ts">
    import { onMount } from 'svelte';

    onMount(async () => {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (res.ok) {
                window.location.href = '/modes/?login=true';
            } else {
                window.location.href = '/login?error=oauth_failed';
            }
        } catch {
            window.location.href = '/login?error=oauth_failed';
        }
    });
</script>

<!-- notification redirection -->
<div class="flex items-center justify-center h-screen">
    <p class="text-slate-400">Logging in...</p>
</div>