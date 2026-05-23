import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';


export const load: PageServerLoad = async ({ cookies, fetch }) => {
const token = cookies.get('auth_token');

if (token) {
try {
const response = await fetch('http://backend:3000/api/user/me', {
headers: { Authorization: `Bearer ${token}` }
});

if (response.ok) {
redirect(302, '/modes');
} else {
// Token is invalid, clear it
cookies.delete('auth_token', { path: '/' });
}
} catch (error) {
// Network error, clear token to be safe
cookies.delete('auth_token', { path: '/' });
}
}
};
