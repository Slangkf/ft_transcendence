import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
	// Get the authentication token from cookies
	// If no token, user is not connected
	const token = cookies.get('auth_token');
	if (!token) {
		return {
			connected: false
		}
	}

	// Call backend API to verify the token
	// If request is successful, user is connected
	// Otherwise (invalid or expired token), user is not connected
	try {
		const response = await fetch('http://backend:3000/api/user/me', {
			headers: { Authorization: `Bearer ${token}` }
		});
		return { connected: response.ok }
	}
	// If an error occurs (network, server down, etc.), consider the user as not connected
	catch (error) {
		console.error('Exception thrown in layout.server.ts: ', error)
		return { connected: false }
	}
};
