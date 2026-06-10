<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/shared/toast.svelte';
	import { unreadMap, resetUnread } from '$lib/stores/unread'
	
	let { data } = $props();
	let input = $state("")

	// Redirects to the profile page of the searched username.
	async function searchContact() {
		try {
			const response = await fetch(`/api/user/username/${input}`, {
				credentials: 'include'
			});
			if (!response.ok) {
				if (!input)
					showToast("Please enter a username.");
				else
					showToast("Sorry, the requested user does not exist.");
				return;
			}
			goto(`/profile/${input}`);
			showToast("Redirected to the requested profile.");
		}
		catch (error) {
			showToast("Sorry, an internal error has occurred. Please try again later.");
		}
	}

	// Accepts an incoming friend request and refreshes the page data.
	async function acceptFriendship(request : typeof data.requestList[number]) {
		try {
			const response = await fetch(`/api/friendship/request/${request.id}/accept`, {
				method: 'PUT',
				credentials: 'include'
			});
			if (!response.ok) {
				showToast("Sorry, an internal error has occurred. Please try again later.");
				return;
			}
			await invalidateAll();
			showToast("The request has been accepted.");
		}
		catch (error) {
			showToast("Sorry, an internal error has occurred. Please try again later.");
		}
	}

	// Declines an incoming friend request and refreshes the page data.
	async function rejectFriendship(request : typeof data.requestList[number]) {
		try {
			const response = await fetch(`/api/friendship/request/${request.id}/decline`, {
				method: 'DELETE',
				credentials: 'include'
			});
			if (!response.ok) {
				showToast("Sorry, an internal error has occurred. Please try again later.");
				return;
			}
			await invalidateAll();
			showToast("The request has been rejected.");
		}
		catch (error) {
			showToast("Sorry, an internal error has occurred. Please try again later.");
		}
	}

	// Navigates to the chat page with the selected friend.
	async function openConversation(friend: typeof data.friendsList[number]) {
		const target = friend.friend.id === data.user.id ? friend.user.id : friend.friend.id;
		goto(`/chat/${friend.friend.id === data.user.id ? friend.user.username : friend.friend.username}?with=${target}`);
	}

	// Removes a friend from the friend list and refreshes the page data.
	async function removeFriend(friend: typeof data.friendsList[number]){
		try {
			const target = friend.friend.id === data.user.id ? friend.user.id : friend.friend.id;
			const response = await fetch(`/api/friendship/friend/${target}`, {
				method: 'DELETE',
				credentials: 'include'
			});
			if (!response.ok) {
				showToast("Sorry, an internal error has occurred. Please try again later.");
				return;
			}
			resetUnread(target);
			await invalidateAll();
			showToast("The contact has been successfully deleted.");
		}
		catch (error) {
			showToast("Sorry, an internal error has occurred. Please try again later.");
		}
	}
</script>


<!-- Main card -->
<div class="flex flex-col items-center justify-center w-full max-w-200 rounded-xl p-4 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
	<!-- Main card title -->
	<h2 class="text-2xl font-semibold text-pink-500 text-center">Friends</h2>
	<p class="mt-1 text-pink-500 text-center">Your friends list</p>

	<!-- Search bar -->
	<form class="p-4 w-full mt-4">   
		<label for="search" class ="block mb-2.5 text-sm font-medium text-gray-500 sr-only ">Search</label>
		<div class="relative">
			<div class="absolute inset-y-0 inset-s-0 flex items-center ps-3 pointer-events-none">
				<svg class="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/></svg>
			</div>
			<input onkeydown={(e) => e.key === 'Enter' && searchContact()} type="search" id="search" bind:value={input} class="block w-full p-3 ps-9 bg-slate-900 border border-slate-700 text-sm rounded-md focus:outline-none focus:ring-2 transition focus:ring-indigo-500 focus:border-indigo-500 shadow-sm placeholder:text-gray-500" placeholder="Search a user"/>
			<button onclick={() => searchContact()} type="button" class="absolute inset-e-1.5 bottom-1.5 text-slate-200 bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-indigo-500 shadow-sm font-medium leading-5 rounded-md text-xs px-4 py-2 focus:outline-none cursor-pointer">Search</button>
		</div>
	</form>

	<!-- Pending invitation list -->
	<div class="flex flex-col w-full gap-3 mt-4">
		{#each data.requestList as request}
			<div class="flex items-center justify-between w-full px-4 py-3 border border-slate-700 bg-slate-800 rounded-xl">
				
				<!-- Avatar + username -->
				<div class="flex items-center gap-3">
					<img src={request.friend.id === data.user.id ? request.user.url : request.friend.url} alt="avatar" class="h-12 w-12 rounded-full object-cover"/>
					<span class="text-white font-medium">{request.friend.id === data.user.id ? request.user.username : request.friend.username}</span>
				</div>
				
				<!-- Buttons -->
				<div class="flex flex-col sm:flex-row items-center gap-3">
					<!-- Accept friendship request -->
					<button onclick={() => acceptFriendship(request)} class="w-full sm:w-auto cursor-pointer px-3 py-1 text-sm font-medium text-slate-200 bg-slate-500 rounded-md hover:bg-slate-600">Accept</button>
					<!-- Denied friendship request -->
					<button onclick={() => rejectFriendship(request)} class="w-full sm:w-auto cursor-pointer px-3 py-1 text-sm font-medium text-slate-200 bg-red-500 rounded-md hover:bg-red-600">Denied</button>
				</div>
			</div>
		{:else}
			
			<!-- No pending friend requests message -->
			<div class="flex items-center justify-center w-full px-4 py-3 border border-slate-700 rounded-xl">
				<p class="text-pink-500 font-medium">No pending friend requests</p>
			</div>
		{/each}
	</div>

	<!-- Friends list -->
	<div class="flex flex-col w-full gap-3 mt-4">
		{#each data.friendsList as friend}
			<div class="flex items-center justify-between w-full px-4 py-3 border border-slate-700 bg-slate-800 rounded-xl">

				<!-- Avatar + username -->
				<div class="flex items-center gap-3">
					<img src={friend.friend.id === data.user.id ? friend.user.url : friend.friend.url} alt="avatar" class="h-12 w-12 rounded-full object-cover"/>
					<span class="text-slate-200 font-medium">{friend.friend.id === data.user.id ? friend.user.username : friend.friend.username}</span>
				</div>

				<!-- Buttons -->
				<div class="flex flex-col sm:flex-row items-center gap-3">
					<!-- Profile -->
					<button onclick={() => goto(`/profile/${ friend.friend.id === data.user.id ? friend.user.username : friend.friend.username }`)} type="submit" class="w-full sm:w-auto cursor-pointer px-3 py-1 text-sm font-medium text-slate-200 bg-slate-500 rounded-md hover:bg-slate-600">Profile</button>
					<!-- Chat -->
					<button onclick={() => openConversation(friend)} class="w-full sm:w-auto cursor-pointer px-3 py-1 text-sm font-medium text-slate-200 bg-slate-500 rounded-md hover:bg-slate-600">Chat
						{#if $unreadMap[String(friend.friend.id === data.user.id ? friend.user.id : friend.friend.id)] > 0}
							<span class="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-blue-500 rounded-full ml-1">
								{$unreadMap[String(friend.friend.id === data.user.id ? friend.user.id : friend.friend.id)]}
							</span>
    					{/if}
					</button>
					<!-- Remove -->
					<button onclick={() => removeFriend(friend)} class="cursor-pointer px-3 py-1 text-sm font-medium text-slate-200 bg-red-500 rounded-md hover:bg-red-600">Remove</button>
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
		<button onclick={() => goto('/profile')} class="cursor-pointer px-4 py-2 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Back</button>
	</div>
</div>
