import type { PageServerLoad } from './$types';
import { error, redirect, isRedirect, isHttpError } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies, fetch, params }) => {
	// Redirect unauthenticated users to login
	const token = cookies.get('auth_token');
	if (!token) {
		console.error('No auth token found in cookies in /friends/[username]');
		throw redirect(302, '/login');
	}

	try {
		// Fetch the user object matching the requested username
		// If the user does not exist, display a 404 error page
		const [userResponse, friendsResponse] = await Promise.all ([
			fetch(`http://backend:3000/api/user/username/${ params.username }`, {
				headers: { Authorization: `Bearer ${token}` }
			}),
			fetch(`http://backend:3000/api/friendship/friends/${ params.username }`, {
				headers: { Authorization: `Bearer ${token}` }
			})
		]);
		if (!userResponse.ok) {
			console.error('Failed to fetch user in /friends/[username]:', userResponse.status);
			throw error(404, 'User not found')
		}
		if (!friendsResponse.ok)
			console.error('Failed to fetch friends list in /friends/[username]:', friendsResponse.status);

		const user = await userResponse.json();
		const friendsList = friendsResponse.ok ? (await friendsResponse.json()).data : [];

		return { user, friendsList };
	}
	// Rethrow SvelteKit-handled errors to let the framework handle them natively
	// Log unexpected errors (network failure, runtime errors, etc)
	catch (error) {
		if (isRedirect(error) || isHttpError(error))
			throw error;
		console.error('Unexpected error in /friends/[username] load function:', error);
		return {user: null, friendsList: []};
	}
};
