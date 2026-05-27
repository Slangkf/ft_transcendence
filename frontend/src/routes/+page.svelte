<script lang="ts">
	import { Register_Input, type RegisterInput } from '$lib/shared/user.schema';
	import { showToast } from '$lib/shared/toast.svelte';
	import { onMount } from 'svelte'
	import { page } from '$app/state';

	// Shows a notification after logging out.
	onMount(() => {
		page.url.searchParams.get('logout') && showToast("You are now disconnected, see you soon.");
	});

	// Reactive object storing form error messages.
	let errors = $state({
		email: "",
		username: "",
		password: ""
	});


	/*
	* Handles form submission:
	* - Prevents default page reload.
	* - Extracts and validates user input using Zod schema.
	* - Maps validation errors to their corresponding form fields.
	* - Sends registration data to the API and handles backend errors.
	* - Redirects to the home page on success.
	*/
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const email = (form.email as HTMLInputElement).value;
		const username = (form.username as HTMLInputElement).value;
		const password = (form.password as HTMLInputElement).value;

		errors.email = "";
		errors.username = "";
		errors.password = "";
		
		const validation = Register_Input.safeParse({
			email,
			username,
			password
		});
		if (!validation.success) {
			for (const issue of validation.error.issues) { 
				const field = issue.path[0] as keyof RegisterInput;
				errors = { ...errors, [field]: issue.message };
			}
			return;
		}

		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: {'Content-Type': 'application/json' },
				body: JSON.stringify({ email, username, password})
			});
			const result = await response.json();
			if (!response.ok) {
				if (result.error?.code === "AUTH_MAIL_ALREADY_EXIST")
					errors.email = result.error.message;
				else if (result.error?.code === "AUTH_USERNAME_ALREADY_EXIST")
					errors.username = result.error.message;
				return;
			}
			window.location.href = '/modes/?register=true';
		}
		catch (error){
			console.error('Register page error: ', error);
			showToast("Sorry, an internal error has occurred. Please try again later.");
		}
	}
</script>

<!-- Sign up card -->
<div class="sm:pb-50">
	<div class="flex flex-col justify-center w-full max-w-80 rounded-xl px-6 py-8 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
		<!-- Title -->
		<h2 class="text-2xl font-semibold text-pink-500 text-center">Sign Up</h2>
		<p class="mt-1 text-pink-500 text-center">Create an account</p>

		<!-- Form -->
		<form onsubmit={handleSubmit} class="mt-8">
			<!-- Mail shield -->
			<label for="email" class="block mb-1 font-medium text-pink-500">Email address</label>
			<input type="email" id="email" name="email" placeholder="Email" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500">
			{#if errors.email}
				<p class="text-red-500 text-xs mb-2">{errors.email}</p>
			{/if}

			<!-- Username shield -->
			<label for="username" class="block mb-1 font-medium text-pink-500">Username</label>
			<input type="text" id="username" name="username" placeholder="Username" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500">
			{#if errors.username}
				<p class="text-red-500 text-xs mb-2">{errors.username}</p>
			{/if}

			<!-- Password shield -->
			<label for="password" class="block mb-1 font-medium text-pink-500">Password</label>
			<input type="password" id="password" name="password" placeholder="Password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500">
			{#if errors.password}
				<p class="text-red-500 text-xs mb-2">{errors.password}</p>
			{/if}

			<!-- Already Registered link -->
			<div class="text-right">
				<a href="/login" class="font-medium text-blue-500 hover:text-pink-500">Already registered?</a>
			</div>

			<!-- Register button -->
			<button type="submit" class="w-full mt-10 px-4 py-2.5 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Register</button>
		</form>
		<div class="flex items-center my-4 mt-6">
    		<div class="flex-1 border-t border-slate-700"></div>
    		<span class="mx-3 text-slate-400 text-xs">or</span>
    		<div class="flex-1 border-t border-slate-700"></div>
		</div>
		<!-- GitHub OAuth button -->
		<a 
		    href="https://localhost:8888/api/auth/github"
		    class="flex items-center justify-center gap-2 w-full px-4 py-2.5 font-medium text-slate-200 bg-slate-700 rounded-md hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500"
		>
		    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
		        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
		    </svg>
		    Continue with GitHub
		</a>

	</div>
</div>
