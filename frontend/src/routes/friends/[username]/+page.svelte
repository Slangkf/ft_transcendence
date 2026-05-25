<script lang="ts">
	import { goto } from '$app/navigation';
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/shared/toast.svelte'

	let { data } = $props();

	// Sends a friend request to the selected user.
	// Handles backend errors: self-request, pending invitation, or already friends.
	async function friendAddHandler(friend: typeof data.friendsList[number]) {
		const targetID = data.user.id === friend.user.id ? friend.friend.id : friend.user.id;
		try {
			const response = await fetch('/api/friendship/request', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				credentials: 'include',
				body: JSON.stringify({ friendId:targetID })
			});
			const result = await response.json();
			if (!response.ok) {
				if (result.error?.code === "FRIEND_SELF_REQUEST")
					showToast("Sorry, you cannot add yourself as a friend.");
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
<div class="flex flex-col items-center justify-center w-full max-w-200 rounded-xl p-4 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
	<!-- Main card title -->
	<h2 class="text-2xl font-semibold text-pink-500 text-center">Friends</h2>
	<p class="mt-1 text-pink-500 text-center">{data.user.username ?? "Default"}'s friends list</p>
	
	<!-- Friends list -->
	<div class="flex flex-col w-full gap-3 mt-6">
		{#each data.friendsList as friend}
			<div class="flex items-center justify-between w-full px-4 py-3 border border-slate-700 bg-slate-800 rounded-xl">
				<!-- Avatar + username -->
				<div class="flex items-center gap-3">
					<img src={data.user.id === friend.user.id ? friend.friend.url : friend.user.url} alt="avatar" class="h-12 w-12 rounded-full object-cover"/>
					<span class="text-white font-medium">{data.user.id === friend.user.id ? friend.friend.username : friend.user.username}</span>
				</div>
				
				<!-- Buttons -->
				<div class="flex items-center gap-3">
					<!-- Profile -->
					<button onclick={() => goto(`/profile/${ data.user.id === friend.user.id ? friend.friend.username : friend.user.username }`)} type="submit" class="cursor-pointer px-4 py-2 font-medium text-slate-200 bg-slate-500 rounded-md hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Profile</button>
					<!-- Add friend -->
					<button onclick={() => friendAddHandler(friend)} type="submit" class="cursor-pointer px-4 py-2 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Add as friend</button>
				</div>
			</div>
		{:else}
			<!-- No friends message -->
			<div class="flex items-center justify-center w-full px-4 py-3 border border-slate-700 rounded-xl">
				<p class="text-pink-500 font-medium">No friends yet</p>
			</div>
		{/each}
	</div>
	<!-- Go back button -->
	<div class="flex items-center mt-4">
		<button onclick={() => goto(`/profile/${data.user.username}`)} class="cursor-pointer px-4 py-2 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Back</button>
	</div>
</div>
