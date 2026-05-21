import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';


export const load: PageServerLoad = async ({ cookies, fetch }) => {
	// Redirect authenticated users to the mode page
	const token = cookies.get('auth_token');
	if (token) {
		redirect(302, '/modes');
	}
};
