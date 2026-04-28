// import { redirect } from '@sveltejs/kit';

// export async function load({ fetch }) {
// 	const response = await fetch('/api/user/me');
// 	if (!response.ok) {
// 		console.error('Load profile page error');
// 		throw redirect(302, '/login');
// 	}	
// 	const user = await response.json();
// 	return { user };
// }