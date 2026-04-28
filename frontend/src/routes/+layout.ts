// Checks authentication state via /api/user/me using cookies.
// Returns `connected: true` if authenticated, otherwise false.
// Non-auth (e.g. 401) is treated as a normal state, not an error.
export async function load ({ fetch }) {
	try {
		const response = await fetch('/api/user/me', {
			credentials: 'include'
		});
		return {
			connected: response.ok
		};
	}
	catch {
		console.error('Load layout menu error');
		return {
			connected: false
		}
	}
}
