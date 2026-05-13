<script lang="ts">
	import { goto } from '$app/navigation';
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/toast.svelte'

	const { data } = $props();

	async function friendAddHandler() {
		try {
			const response = await fetch('/api/friendship/request', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				credentials: 'include',
				body: JSON.stringify({ friendId:data.user.id })
			});
			const result = await response.json();
			if (!response.ok) {
				if (result.error?.code === "FRIEND_SELF_REQUEST")
					showToast("You cannot add yourself as a friend.");
				else if (result.error?.code === "FRIEND_REQUEST_PENDING")
					showToast("An invitation is already awaiting validation.");
				else if (result.error?.code === "FRIEND_ALREADY_EXISTS")
					showToast("You are already friends.");
				return;
			}
			await invalidateAll();
			showToast("Your invitation has been sent.");
		}
		catch(error){
			console.error('Exception thrown in the friend requesting function: ', error);
			showToast("Sorry, an internal error has occurred. Please try again later.");
		}
	}
</script>

<!-- Main card -->
<div class="flex flex-col items-center justify-center w-full max-w-120 rounded-xl px-6 py-8 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
	<!-- Main card title -->
	<h2 class="text-2xl font-semibold text-pink-500 text-center">Profile</h2>
	<p class="mt-1 text-pink-500 text-center">{data.user.username ?? "Unknown data"}'s profile page</p>
	
	<!-- Avatar -->
	<img src={data.user.url ?? "/images/avatar.jpg"} alt="avatar" class="h-37 w-37 rounded-full object-cover mt-8">
	
	<!-- Add friend button -->
	<button onclick={() => friendAddHandler()} type="submit" class="cursor-pointer mt-4 px-4 py-2 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Add as friend</button>
	
	<!-- Account information card -->
	<div class="flex flex-col w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-8 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Account</h3>
		<!-- Informations -->
		<div class="flex justify-between mb-3">
			<span class="text-sm text-slate-400">Status</span>
    		<span class={data.user.status === "ONLINE" ? "text-green-500" : "text-red-500"}>{data.user.status}</span>
		</div>
		<div class="flex justify-between mb-3">
			<span class="text-sm text-slate-400">Username</span>
			<span class="text-white">{data.user.username ?? "Unknown data"}</span>
		</div>
	</div>

	<!-- Statistic card-->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
	<!-- Statistic title -->
		<h3 class="text-lg text-pink-500 mb-4">Statistics</h3>
		<!-- Statistic cards -->
		<div class="flex justify-between mb-3">
			<span>Games played</span>
			<span>{data.user.played ?? "Unknown data"}</span>
		</div>
		<div class="flex justify-between mb-3">
			<span>Games won</span>
			<span>{data.user.wins ?? "Unknown data"}</span>
		</div>
		<div class="flex justify-between mb-3">
			<span>Average score</span>
			<span>{data.user.score ?? "Unknown data"}%</span>
		</div>
	</div>

	<!-- Friend card -->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Social</h3>
		<!-- Statistics -->
		<div class="flex justify-between mb-3">
			<span>Friends</span>
			<span>{data.user.friendsNb ?? "Unknown data"}</span>
		</div>
		<!-- View username's Friends button -->
		<button onclick={() => goto(`/friends/${ data.user.username }`)} class="cursor-pointer ursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">View {data.user.username }'s friends</button>
	</div>
	<!-- Go back button -->
	<div class="flex items-center mt-4">
		<button onclick={() => goto('/friends')} class="cursor-pointer px-4 py-2 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Back</button>
	</div>
</div>
