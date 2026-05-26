import { redirect, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/*
 * Protects the /chat route and loads the data needed to render the chat page.
 * - No token: redirects to /login.
 * - Fetches the authenticated user and the friend's data in parallel.
 * - If any request fails, returns null for that resource.
 */
export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
	// Redirect unauthenticated users to login
	const token = cookies.get('auth_token');
	if (!token) {
		console.error('cookies.get error in the chat section')
		throw redirect(302, '/login');
	}
	try {
		const [userResponse, friendResponse] = await Promise.all([
			fetch('http://backend:3000/api/user/me', {
				headers: { Authorization: `Bearer ${token}` }
			}),
			fetch(`http://backend:3000/api/user/${url.searchParams.get('with')}`, {
				headers: { Authorization: `Bearer ${token}` }
			}),
		]);
		if (!userResponse.ok)
			console.error('Failed to fetch user informations — /chat:', userResponse.status);
		if (!friendResponse.ok)
			console.error('Failed to fetch friend informations — /chat:', friendResponse.status);

		const user = userResponse.ok ? await userResponse.json(): null;
		const friend = friendResponse.ok ? await friendResponse.json(): null;
		return { user, friend };
	}
	catch (error) {
		if (isRedirect(error)) throw error;
		console.error('Unexpected error in /chat PageServerLoad function:', error);
		return { user: null, friend: null };
	}
};
