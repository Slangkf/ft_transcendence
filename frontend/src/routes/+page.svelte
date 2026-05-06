<script lang="ts">
	// Import navigation helper to redirect user after successful registration.
	// Import Zod schema to check the format of the form inputs.
	import { goto } from '$app/navigation';
	import { invalidateAll } from '$app/navigation';
	import { Register_Input, type RegisterInput } from '$lib/shared/user.schema';
	import { showToast } from '$lib/toast.svelte';

	// Reactive object storing form error messages.
	let errors = $state({
		email: "",
		username: "",
		password: ""
	});

	async function handleSubmit(event: SubmitEvent) {
		// Prevent default HTML form submission (page reload).
		event.preventDefault();

		// Extract form reference from submit event.
		const form = event.target as HTMLFormElement;
		// Extract user input values from the form fields.
		const email = (form.email as HTMLInputElement).value;
		const username = (form.username as HTMLInputElement).value;
		const password = (form.password as HTMLInputElement).value;

		// Reset previous errors before running new validation.
		errors.email = "";
		errors.username = "";
		errors.password = "";
		
		// Validate input data using Zod schema.
		const validation = Register_Input.safeParse({
			email,
			username,
			password
		});
		// If input, map Zod errors to corresponding form fields.
		if (!validation.success) {
			for (const issue of validation.error.issues) { 
				// Extract the field name that caused the validation error.
				const field = issue.path[0] as keyof RegisterInput;
				// Assign the error message to the corresponding field.
				errors = { ...errors, [field]: issue.message };
			}
			// Stop submission if validation failed.
			return;
		}

		// Send registration data to backend API.
		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: {'Content-Type': 'application/json' },
				body: JSON.stringify({ email, username, password})
			});
			// Parse backend response as JSON.
			const result = await response.json();
			// If HTTP response indicates failure (4xx).
			if (!response.ok) {
				// If backend returned field-specific validation errors.
				if (result.error?.code === "AUTH_MAIL_ALREADY_EXIST")
					errors.email = result.error.message;
				else if (result.error?.code === "AUTH_USERNAME_ALREADY_EXIST")
					errors.username = result.error.message;
				// Stop execution if request failed.
				return;
			}
			// Redirect user after successful registration
			// invalidateAll() will re-run all load functions
			await goto('/modes');
			await invalidateAll();
			showToast("Registration successful. Welcome!");
		}
		// Catch and log unexpected errors.
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

	</div>
</div>
