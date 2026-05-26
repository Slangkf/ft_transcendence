import type { PageServerLoad } from './$types';
import { redirect, isRedirect } from '@sveltejs/kit';


/*
 * Protects the /friends route and loads the data needed to render the page.
 * - No token: redirects to /login.
 * - Fetches user info, pending friend requests, and friends list in parallel.
 * - If any request fails, logs the error and returns an empty list for that resource.
 */
export const load: PageServerLoad = async ({ cookies, fetch }) => {
	const token = cookies.get('auth_token');
	if (!token) {
		console.error('No auth token found in cookies — /friends');
		throw redirect(302, '/login');
	}
	try {
		const [userResponse, requestResponse, friendsResponse] = await Promise.all([
			fetch('http://backend:3000/api/user/me', {
				headers: { Authorization: `Bearer ${token}` }
			}),
			fetch('http://backend:3000/api/friendship/requests/pending', {
				headers: { Authorization: `Bearer ${token}` }
			}),
			fetch('http://backend:3000/api/friendship/friends', {
				headers: { Authorization: `Bearer ${token}` }
			})
		]);
		if (!userResponse.ok)
			console.error('Failed to fetch user informations — /friends:', userResponse.status);
		if (!requestResponse.ok)
			console.error('Failed to fetch pending request list — /friends:', requestResponse.status);
		if (!friendsResponse.ok)
			console.error('Failed to fetch friends list — /friends:', friendsResponse.status);

		const user = userResponse.ok ? await userResponse.json(): null;
		const requestList = requestResponse.ok ? (await requestResponse.json()).data : [];
		const friendsList = friendsResponse.ok ? (await friendsResponse.json()).data : [];

		return { user, requestList, friendsList };
	}
	catch (error) {
		if (isRedirect(error)) throw error;
		console.error('Unexpected error in /friends PageServerLoad function:', error);
		return { user: null, requestList: [], friendsList: [] };
	}
};
