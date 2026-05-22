import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies }) => {
    const token = cookies.get('auth_token');
    if (!token) return {};

    try {
        const response = await fetch('http://backend:3000/api/user/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
            redirect(302, '/modes');
        }
    } catch {
        // token 无效，正常显示 login 页面
    }
    return {};
};