
import type { PageServerLoad } from './$types';
import { error, redirect, isRedirect, isHttpError } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies }) => {
	// Redirect unauthenticated users to login
	const token = cookies.get('auth_token');
	if (!token) {
		console.error('cookies.get error in the chat section')
		throw redirect(302, '/login');
	}
	try {
		const response = await fetch('http://backend:3000/api/user/me', {
				headers: { Authorization: `Bearer ${token}` }
			})
		if (!response.ok)
			console.error('Failed to fetch user informations — /chat:', response.status);
		const user = response.ok ? await response.json(): null;
		return { user };
	}
	catch (error) {
		if (isRedirect(error)) throw error;
		console.error('Unexpected error in /chat PageServerLoad function:', error);
		return { user: null };
	}
};
