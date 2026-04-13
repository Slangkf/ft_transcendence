<!-- Handle form submit: prevent reload and send POST request to backend -->
<script lang="ts">
	import { goto } from '$app/navigation';	
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const email = (form.email as HTMLInputElement).value;
		const username = (form.username as HTMLInputElement).value;
		const password = (form.password as HTMLInputElement).value;

		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: {'Content-Type': 'application/json' },
				body: JSON.stringify({ email, username, password})
			});

			const result = await response.json();
			console.log(result);

			 await goto('/api/user/me'); // redirection to profil
		}
		catch (error){
			console.error('Error login: ', error);
		}
	}
</script>

<div class="flex justify-center pt-27">
	<div class="flex flex-col justify-center w-full max-w-80 rounded-xl px-6 py-8 border border-slate-700 bg-slate-900/90 backdrop-blur-xs text-white text-sm">
		<h2 class="text-2xl font-semibold text-pink-500 text-center">Sign Up</h2>
		<p class="mt-1 text-pink-500 text-center">Create an account</p>
		<form onsubmit={handleSubmit} class="mt-8">
			<label for="email" class="block mb-1 font-medium text-pink-500">Email address</label>
			<input type="email" id="email" name="email" placeholder="Email" class="w-full p-2 mb-3 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500">
			
			<label for="username" class="block mb-1 font-medium text-pink-500">Username</label>
			<input type="text" id="username" name="username" placeholder="Username" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500">

			<label for="password" class="block mb-1 font-medium text-pink-500">Password</label>
			<input type="password" id="password" name="password" placeholder="Password" class="w-full p-2 mb-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:ring-1 transition focus:ring-indigo-500 focus:border-indigo-500">

			<button type="submit" class="w-full mt-10 px-4 py-2.5 font-medium text-slate-200 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">Register</button>
		</form>
	</div>
</div>
