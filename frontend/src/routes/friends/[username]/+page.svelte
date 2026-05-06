<script lang="ts">
	let { data } = $props();

</script>


<!-- Main card -->
<div class="flex flex-col items-center justify-center w-full max-w-200 rounded-xl p-4 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
	<!-- Main card title -->
	<h2 class="text-2xl font-semibold text-pink-500 text-center">Friends</h2>
	<p class="mt-1 text-pink-500 text-center">Your friends list</p>

	<!-- Friends list -->
	<div class="flex flex-col w-full gap-3 mt-6">
		{#each data.friends as friend}
			<div class="flex items-center justify-between w-full px-4 py-3 border border-slate-700 bg-slate-800 rounded-xl">
				
				<!-- Avatar + username -->
				<div class="flex items-center gap-3">
					<img src={friend.url ?? "/images/avatar.jpg"} alt="avatar" class="h-12 w-12 rounded-full object-cover"/>
					<span class="text-white font-medium">{friend.username}</span>
				</div>
				
			</div>
		{/each}
	</div>
</div>