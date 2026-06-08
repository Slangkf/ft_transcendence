import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

/*
 * Protects the game route.
 * - No token: redirects to /login.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('auth_token');
	if (!token) {
		console.error('cookies.get error in the tournament section')
		throw redirect(302, '/login');
	}
};
