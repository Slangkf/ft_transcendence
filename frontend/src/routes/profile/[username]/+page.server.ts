import type { PageServerLoad } from './$types';
import { error, redirect, isRedirect, isHttpError } from '@sveltejs/kit';

/*
 * Protects the /profile/[username] route and loads the requested user's profile.
 * - No token: redirects to /login.
 * - Unknown username: throws a 404 error.
 * - Valid request: returns the user data to the page component.
 */
export const load: PageServerLoad = async ({ cookies, fetch, params }) => {
	const token = cookies.get('auth_token');
	if (!token) {
		console.error('cookies.get error in the profile/[username] section')
		throw redirect(302, '/login');
	}

	try {
		const profileResponse = await fetch(`http://backend:3000/api/user/username/${ params.username }`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!profileResponse.ok) {
			console.error('fetch error in the /profile/[username] section: ', profileResponse.ok)
			throw error(404, 'User not found')
		}
		const user = await profileResponse.json();
		return { user };
	}
	// Rethrow SvelteKit-handled errors to let the framework handle them natively.
	// Log unexpected errors (network failure, runtime errors, etc).
	catch (err) {
		if (isRedirect(err) || isHttpError(err))
			throw err;
		else
			console.error('Unexpected error in /profile/[username] load function: ', err);
	}
};
