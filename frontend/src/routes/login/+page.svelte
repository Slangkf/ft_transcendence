<!-- Handle form submit: prevent reload and send POST request to backend -->
<script lang="ts">
	import { Login_Input, type LoginInput } from '$lib/shared/user.schema';
	import { showToast } from '$lib/shared/toast.svelte'

	// Reactive object storing form error messages.
	let errors = $state({
		email: "",
		password: ""
	});

	async function handleSubmit(event: SubmitEvent) {
		// Prevent default HTML form submission (page reload).
		event.preventDefault();

		// Extract form reference from submit event.
		const form = event.target as HTMLFormElement;
		const email = (form.email as HTMLInputElement).value;
		const password = (form.password as HTMLInputElement).value;

		// Reset previous errors before running new validation.
		errors.email = "";
		errors.password = "";

		// Validate input data using Zod schema.
		const validation = Login_Input.safeParse({
			email,
			password
		});
		// If input, map Zod errors to corresponding form fields.
		if (!validation.success) {
			for (const issue of validation.error.issues) { 
				// Extract the field name that caused the validation error.
				const field = issue.path[0] as keyof LoginInput;
				// Assign the error message to the corresponding field.
				errors = { ...errors, [field]: issue.message };
			}
			// Stop submission if validation failed.
			return;
		}

		// Send connection data to backend API.
		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				credentials: 'include',
				headers: {'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password})
			});

			// Parse backend response as JSON.
			const result = await response.json();
			// If HTTP response indicates failure (4xx).
			if (!response.ok) {
				// If backend returned field-specific validation errors.
				if (result.error?.code === 'AUTH_INVALID_MAIL')
					errors.email = result.error.message;
				else if (result.error?.code === 'AUTH_INVALID_PASSWORD')
					errors.password = result.error.message;
				// Stop execution if request failed.
				return;
			}
			// Redirect user after successful registration.
			window.location.href = '/modes/?login=true';
		}
		// Catch and log unexpected errors.
		catch (error){
			console.error('Login page error: ', error);
			showToast("Sorry, an internal error has occurred. Please try again later.");
		}
	}
</script>

<!-- Login card -->
<div class="sm:pb-50">
	<div class="w-full max-w-80 rounded-xl px-6 py-8 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
		<!-- Title -->
		<h2 class="text-2xl font-semibold text-pink-500 text-center">Sign In</h2>
		<p class="mt-1 text-pink-500 text-center">Connection to your account</p>
		
		<!-- Form -->
		<form onsubmit={handleSubmit} class="mt-8">
			<!-- Mail shield -->
			<label for="email" class="block mb-1 font-medium text-pink-500">Email address</label>
			<input type="email" id="email" name="email" placeholder="Email" class="w-full p-2 mb-3 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500">
			{#if errors.email}
				<p class="text-red-500 text-xs mb-2">{errors.email}</p>
			{/if}
			
			<!-- Password shield -->
			<label for="password" class="block mb-1 font-medium text-pink-500">Password</label>
			<input type="password" id="password" name="password" placeholder="Password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500">			
			{#if errors.password}
				<p class="text-red-500 text-xs mb-2">{errors.password}</p>
			{/if}
			
			<!-- Login button -->
			<button type="submit" class="w-full mt-10 px-4 py-2.5 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Login</button>
		</form>
	</div>
</div>
