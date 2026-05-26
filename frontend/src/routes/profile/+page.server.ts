import type { PageServerLoad } from './$types';
import { redirect, isRedirect } from '@sveltejs/kit';

/*
 * Protects the route by checking the auth token.
 * - No token: redirects to /login.
 * - Valid token: fetches and returns the authenticated user data.
 * - Invalid token or fetch failure: redirects to /modes.
 */
export const load: PageServerLoad = async ({ cookies, fetch }) => {
	const token = cookies.get('auth_token');
	if (!token) throw redirect(302, '/login');

	try {
		const response = await fetch('http://backend:3000/api/user/me', {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!response.ok) {
			console.error('fetch error in the profile section')
			throw redirect(302, '/modes');
		}
		const user = await response.json();
		return { user };
	}
	catch (error) {
		if (isRedirect(error)) throw error;
		console.error('Error profile page: ', error);
	}
};
