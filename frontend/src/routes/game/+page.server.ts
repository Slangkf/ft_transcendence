
import type { PageServerLoad } from './$types';
import { error, redirect, isRedirect, isHttpError } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies }) => {
	// Redirect unauthenticated users to login
	const token = cookies.get('auth_token');
	console.log(token);
	if (!token) {
		console.error('cookies.get error in the profile/[username] section')
		throw redirect(302, '/login');
	}
};
