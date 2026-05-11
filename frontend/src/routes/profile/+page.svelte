<script lang="ts">
	import { goto } from '$app/navigation';
	import { invalidateAll } from '$app/navigation';
	import { Change_Username_Input, type ChangeUsernameInput } from '$lib/shared/user.schema';
	import { Change_Pd_Input, type ChangePdInput } from '$lib/shared/user.schema';
	import { showToast } from '$lib/toast.svelte'

	let { data } = $props();
	let fileInput = $state<HTMLInputElement | null>(null)
	
	// Display the default avatar with the URL returned by the backend
	let avatarUrl = $state(data.user.url)

	// Reactive object storing form error messages.
	let errors = $state({
		avatar: "",
		username: "",
		oldpassword: "",
		newpassword: "",
		confirmpd: ""
	});

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
			showToast("Sorry, you need to select an avatar before continuing.");
			return;
		}

		errors.avatar = "";

		// Type and size verifications
		const allowedType = ['image/png', 'image/jpeg']
		if (!allowedType.includes(file.type)) {
			showToast("Sorry, only .png, or .jpg/jpeg files are allowed.");
			return;
		}
		const maxSize = 2 * 1024 * 1024
		if (file.size > maxSize) {
			showToast("Sorry, the file size cannot exceed 2 MO.");
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
			const result = await response.json();
			if (!response.ok) {
				if (result.error?.code === "AVATAR_REQUIRED")
					errors.avatar = result.error.message;
				return;
			}

			// Update the displayed avatar with the URL returned by the backend
			avatarUrl = result.url
			showToast("Your avatar has been successfully changed");
		}
		catch (error){
			console.error('Exception thrown in the avatar sending function: ', error);
			showToast("Sorry, an internal error has occurred. Please try again later.");
		}
	}

	async function handleUsernameSubmission(event: SubmitEvent) {
		// Prevent default HTML form submission (page reload).
		event.preventDefault();
		// Extract form reference from submit event.
		const form = event.target as HTMLFormElement;
		const username = (form.username as HTMLInputElement).value;

		// Reset previous errors before running new validation.
		errors.username = "";

		// Validate input data using Zod schema.
		const validation = Change_Username_Input.safeParse({
			username
		});
		// If input, map Zod errors to corresponding form fields.
		if (!validation.success) {
			for (const issue of validation.error.issues) { 
				// Extract the field name that caused the validation error.
				const field = issue.path[0] as keyof ChangeUsernameInput;
				// Assign the error message to the corresponding field.
				errors = { ...errors, [field]: issue.message };
			}
			// Stop submission if validation failed.
			return;
		}

		// Send new username data to backend API.
		try {
			const response = await fetch('/api/user/me/changeusername', {
				method: 'POST',
				headers: {'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ newUsername: username })
			});
			// Parse backend response as JSON.
			const result = await response.json();
			// If HTTP response indicates failure (4xx).
			if (!response.ok) {
				// If backend returned field-specific validation errors.
				if (result.error?.code === "SAME_NEW_OLD_USERNAME")
					errors.username = result.error.message;
				else if (result.error?.code === "AUTH_USERNAME_ALREADY_EXIST")
					errors.username = result.error.message;
				// Stop execution if request failed.
				return;
			}
			// Re-run all load functions
			await invalidateAll();
			showToast("Your username has been successfully changed");
		}
		catch (error){
			console.error('Error login: ', error);
			showToast("Sorry, an internal error has occurred. Please try again later.");
		}
	}

	async function handlePasswordSubmission(event: SubmitEvent) {
		// Prevent default HTML form submission (page reload).
		event.preventDefault();
		// Extract form reference from submit event.
		const form = event.target as HTMLFormElement;
		const oldpassword = (form.oldpassword as HTMLInputElement).value;
		const newpassword = (form.newpassword as HTMLInputElement).value;
		const confirmpassword = (form.confirmpassword as HTMLInputElement).value;

		// Reset previous errors before running new validation.
		errors.oldpassword = "";
		errors.newpassword = "";
		errors.confirmpd = "";

		// Validate input data using Zod schema.
		const validation = Change_Pd_Input.safeParse({
			newpassword: newpassword,
			confirmpd: confirmpassword
		});
		// If input, map Zod errors to corresponding form fields.
		if (!validation.success) {
			for (const issue of validation.error.issues) { 
				// Extract the field name that caused the validation error.
				const field = issue.path[0] as keyof ChangePdInput;
				// Assign the error message to the corresponding field.
				errors = { ...errors, [field]: issue.message };
			}
			// Stop submission if validation failed.
			return;
		}

		// Send new password data to backend API.
		try {
			const response = await fetch('/api/user/me/changepassword', {
				method: 'POST',
				headers: {'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ oldpassword, newpassword })
			});
			// Parse backend response as JSON.
			const result = await response.json();
			console.log(result)
			// If HTTP response indicates failure (4xx).
			if (!response.ok) {
				// If backend returned field-specific validation errors.
				if (result.error?.code === "INVALID_OLD_PASSWORD")
					errors.oldpassword = result.error.message;
				else if (result.error?.code === "SAME_NEW_OLD_PASSWORD")
					errors.newpassword = result.error.message;
				// Stop execution if request failed.
				return;
			}
			// Re-run all load functions
			await invalidateAll();
			showToast("Your password has been successfully changed. Please log in again.");
		}
		catch (error){
			console.error('Error login: ', error);
			showToast("Internal error, please try later");
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
		<form onsubmit={handleUsernameSubmission}>
			<input type="text" name="username" placeholder="New username" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
			{#if errors.username}
				<p class="text-red-500 text-xs mb-2">{errors.username}</p>
			{/if}
			<!-- Update button -->
			<button type="submit" class="cursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Update username</button>
		</form>
	</div>
	
	<!-- Password handler -->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Change password</h3>
		<!-- New password shields -->
		<form onsubmit={handlePasswordSubmission}>
			<input type="password" name="oldpassword" placeholder="Old password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
			{#if errors.oldpassword}
				<p class="text-red-500 text-xs mb-2">{errors.oldpassword}</p>
			{/if}
			<input type="password" name="newpassword" placeholder="New password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
			{#if errors.newpassword}
				<p class="text-red-500 text-xs mb-2">{errors.newpassword}</p>
			{/if}
			<input type="password" name="confirmpassword" placeholder="Confirm new password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500" />
			{#if errors.confirmpd}
				<p class="text-red-500 text-xs mb-2">{errors.confirmpd}</p>
			{/if}
			<!-- Update button -->
			<button type="submit" class="cursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Update password</button>
		</form>
	</div>
	
	<!-- Statistic card -->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Statistic title -->
		<h3 class="text-lg text-pink-500 mb-4">Statistics</h3>
		<!-- Statistic cards -->
		<div class="flex justify-between mb-3">
			<span class="text-sm text-slate-400">Games played</span>
			<span>{ data.user.played ?? "Unknown data" }</span>
		</div>
		<div class="flex justify-between mb-3">
			<span class="text-sm text-slate-400">Games won</span>
			<span>{ data.user.wins ?? "Unknown data" }</span>
		</div>
		<div class="flex justify-between mb-3">
			<span class="text-sm text-slate-400">Average score</span>
			<span>{ data.user.score ?? "Unknown data" }%</span>
		</div>
	</div>
	
	<!-- Friend card-->
	<div class="w-full px-6 py-6 border border-slate-700 bg-slate-900/90 mt-6 rounded-xl">
		<!-- Title -->
		<h3 class="text-lg text-pink-500 mb-4">Social</h3>
		<!-- Statistics -->
		<div class="flex justify-between mb-3">
			<span class="text-sm text-slate-400">Friends</span>
			<span>{ data.user.friendsNb ?? "Unknown data" }</span>
		</div>
		<!-- View Friends button -->
		<button onclick={() => goto('/friends')} class="cursor-pointer mt-4 w-full font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">View friends</button>
	</div>
</div>