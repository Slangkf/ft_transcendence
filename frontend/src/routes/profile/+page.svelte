<script lang="ts">
	import { showToast } from '$lib/toast.svelte'

	let { data } = $props();
	let fileInput = $state<HTMLInputElement | null>(null)
	// Display the default avatar with the URL returned by the backend
	let avatarUrl = $state(data.user.url)

	// Trigger the hidden file input click to open the file picker
	function openFilePicker() {
		fileInput?.click()
	}

	// Handle file selection: upload the chosen file to the backend immediately
	async function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement
		
		// Retrieve the selected file, if any
		const file = input.files?.[0]
		if (!file) {
			showToast("No image selected");
			return;
		}

		// Type and size verifications
		const allowedType = ['image/png', 'image/jpeg']
		if (!allowedType.includes(file.type)) {
			showToast("Only .png, or .jpg/jpeg files are allowed");
			return;
		}
		const maxSize = 2 * 1024 * 1024
		if (file.size > maxSize) {
			showToast("File size must not exceed 2Mo");
			return;
		}

		// Build a FormData with the selected file
		// FormData is the standard way to send files over HTTP
		const formData = new FormData();
		formData.append("avatar", file);

		try {
			// Send the avatar to the backend
            // NB: Content-Type header is intentionally omitted so the browser
            // can set it automatically with the correct multipart boundary
			const response = await fetch('/api/user/me/avatar', {
				method: 'POST',
				credentials: 'include',
				body: formData
			});
			if (!response.ok) {
				console.error("fetch error in the avatar sending section");
				return;
			}

			// Update the displayed avatar with the URL returned by the backend
			const result = await response.json()
			avatarUrl = result.url
			showToast("Avatar successfully updated");
		}
		catch (error){
			console.error('Exception throwed in the avatar sending function: ', error);
		}
	}
</script>

<!-- Main card -->
<div class="flex flex-col items-center justify-center w-full max-w-200 rounded-xl p-4 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
	<!-- Main card title -->
	<h2 class="text-2xl font-semibold text-pink-500 text-center">Profile</h2>
	<p class="mt-1 text-pink-500 text-center">Your personnal informations</p>

	<!-- Avatar -->
	<img src={ avatarUrl ?? "/images/avatar.jpg"} alt="avatar" class="h-37 w-37 rounded-full object-cover mt-8">
	<!-- Hidden file input: opens the native file picker when triggered, stores the selected file in fileInput via bind:this, then fires handleFileChange via onchange -->
	<input type="file" accept=".png, .jpg, .jpeg" hidden bind:this={fileInput} onchange={handleFileChange}/>
	<!-- Edit avatar button -->
	<button onclick={openFilePicker} class="cursor-pointer mt-4 px-4 py-2 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Edit</button>
	
	<!-- Account information card -->
	<div class="flex flex-col w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-8 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Account</h3>
		<!-- Informations -->
		<div class="flex justify-between mb-3">
			<span class="text-sm text-slate-400">Email</span>
			<span class="text-white">{ data.user.email ?? "Unknown data" }</span>
		</div>
		<div class="flex justify-between mb-3">
			<span class="text-sm text-slate-400">Username</span>
			<span class="text-white">{ data.user.username ?? "Unknown data" }</span>
		</div>
	</div>
	
	<!-- Username handler -->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Change username</h3>
		<!-- New username shield -->
		<form>
			<input type="text" placeholder="New username" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
			<!-- Update button -->
			<button class="cursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Update username</button>
		</form>
	</div>
	
	<!-- Password handler -->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Change password</h3>
		<!-- New password shields -->
		<form>
			<input type="password" placeholder="New password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
			<input type="password" placeholder="Confirm password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
			<!-- Update button -->
			<button class="cursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Update password</button>
		</form>
	</div>
	
	<!-- Statistic card -->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Statistic title -->
		<h3 class="text-lg text-pink-500 mb-4">Statistics</h3>
		<!-- Statistic cards -->
		<div class="flex justify-between">
			<span class="text-sm text-slate-400">Games played</span>
			<span>{ data.user.played ?? "Unknown data" }</span>
		</div>
		<div class="flex justify-between mt-2">
			<span class="text-sm text-slate-400">Games won</span>
			<span>{ data.user.wins ?? "Unknown data" }</span>
		</div>
		<div class="flex justify-between mt-2">
			<span class="text-sm text-slate-400">Average score</span>
			<span>{ data.user.score ?? "Unknown data" }%</span>
		</div>
	</div>
	
	<!-- Friend card-->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Social</h3>
		<!-- Statistics -->
		<div class="flex justify-between">
			<span class="text-sm text-slate-400">Friends</span>
			<span>{ data.user.friendsNb ?? "Unknown data" }</span>
		</div>
		<!-- View Friends button -->
		<button class="cursor-pointer ursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">View friends</button>
	</div>
</div>