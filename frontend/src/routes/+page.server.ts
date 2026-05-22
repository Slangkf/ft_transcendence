import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';


//export const load: PageServerLoad = async ({ cookies, fetch }) => {
//	// Redirect authenticated users to the mode page
//	const token = cookies.get('auth_token');
//	if (token) {
//		redirect(302, '/modes');
//	}
//};
export const load: PageServerLoad = async ({ cookies }) => {
    const token = cookies.get('auth_token');
    if (!token) return {};
    
    try {
        const response = await fetch('http://backend:3000/api/user/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 401){
				cookies.delete('auth_token', {path: '/'})
			}
        }
		return {connected: false}
    } catch {
        // token 无效，正常显示 signup 页面
    }
    return {};
};