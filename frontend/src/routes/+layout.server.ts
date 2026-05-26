import type { LayoutServerLoad } from './$types';
import { isRedirect } from '@sveltejs/kit';

/*
 * Runs on every page load. Checks if the user is authenticated by validating
 * the auth token against the backend.
 * - No token: returns { connected: false }.
 * - Valid token: returns { connected: true }.
 * - Invalid token (401): deletes the cookie and returns { connected: false }.
 * - Network or server error: returns { connected: false }.
 */
export const load: LayoutServerLoad = async ({ cookies}) => {
	const token = cookies.get('auth_token');
	if (!token) return { connected: false };

	try {
		const response = await fetch('http://backend:3000/api/user/me', {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!response.ok) {
			if (response.status === 401) cookies.delete('auth_token', {path: '/'});
            return { connected: false };
        }
		return { connected: true }
	}
	catch (error) {
		 if (isRedirect(error)) throw error;
		console.error('Exception thrown in layout.server.ts: ', error)
		return { connected: false }
	}
};
