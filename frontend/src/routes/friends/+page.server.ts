import type { PageServerLoad } from './$types';
import { redirect, isRedirect } from '@sveltejs/kit';


export const load: PageServerLoad = async ({ cookies, fetch }) => {
	// Redirect unauthenticated users to login
	const token = cookies.get('auth_token');
	if (!token) {
		console.error('No auth token found in cookies — /friends');
		throw redirect(302, '/login');
	}

	try {
		// Fetch the friends list for the current user
		// If the friends list cannot be retrieved, return an empty list
		const friendsResponse = await fetch('http://backend:3000/api/friendship/friends', {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!friendsResponse.ok) {
			console.error('Failed to fetch friends list — /friends:', friendsResponse.status);
			return {friendsList: []}
		}
		const friendsList = await friendsResponse.json();
		return { friendsList };
	}
	catch (error) {
		if (isRedirect(error)) throw error;
		console.error('Unexpected error in /friends load function:', error);
		return {friendsList: []};
	}
};
