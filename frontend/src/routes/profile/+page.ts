// export async function load() {
// 	const response = await fetch('/api/profile');
// 	const user = await response.json();

// 	return {
// 		user
// 	};
// }

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('auth_token');
  
  if (!token) {
    // 未登录 → 重定向回登录页
    throw redirect(302, '/login');
  }

  // 验证token并获取用户信息
  const response = await fetch('/api/user/me', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw redirect(302, '/login');
  }

  const user = await response.json();
  return { user };
};