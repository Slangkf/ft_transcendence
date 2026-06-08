<script lang="ts">
    import { page } from '$app/state';
	// Displays the HTTP error code and message for any unhandled error in the app.
</script>

<div class="flex flex-col justify-center items-center">
	<h1 class="text-4xl text-pink-500">{page.status}</h1>
	<p class="text-4xl text-pink-500">{page.error?.message}</p>
</div>
