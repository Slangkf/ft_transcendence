import type { PageServerLoad } from './$types';
import { redirect, isRedirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
	// Redirect unauthenticated users to login
	const token = cookies.get('auth_token');
	if (!token) {
		console.error('cookies.get error in the profile section')
		throw redirect(302, '/login');
	}

	try {
		// Fetch current authenticated user using JWT token
		const response = await fetch('http://backend:3000/api/user/me', {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!response.ok) {
			console.error('fetch error in the profile section')
			throw redirect(302, '/');
		}
		const user = await response.json();
		return { user };
	}
	catch (error) {
		if (isRedirect(error)) throw error;
		console.error('Error profile page: ', error);
	}
};
