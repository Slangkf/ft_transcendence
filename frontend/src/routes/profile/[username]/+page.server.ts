
import type { PageServerLoad } from './$types';
import { error, redirect, isRedirect, isHttpError } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies, fetch, params }) => {
	// Redirect unauthenticated users to login
	const token = cookies.get('auth_token');
	console.log(token);
	if (!token) {
		console.error('cookies.get error in the profile/[username] section')
		throw redirect(302, '/login');
	}

	try {
		// Fetch the profile of the requested username
		const profileResponse = await fetch(`http://backend:3000/api/user/username/${ params.username }`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		// If the username does not exist, throw a 404 error to the SvelteKit error handler
		if (!profileResponse.ok) {
			console.error('fetch error in the /profile/[username] section: ', profileResponse.ok)
			throw error(404, 'User not found')
		}
		// Parse and return the user data to the page component
		const user = await profileResponse.json();
		return { user };
	}
	// Rethrow SvelteKit-handled errors to let the framework handle them natively
	// Log unexpected errors (network failure, runtime errors, etc)
	catch (err) {
		if (isRedirect(err) || isHttpError(err))
			throw err;
		else
			console.error('Unexpected error in /profile/[username] load function: ', err);
	}
};
