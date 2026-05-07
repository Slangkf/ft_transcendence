import type { UserOutput } from '@shared/user.schema';

declare global {
    namespace Express {
        interface Request {
            user?: Pick<UserOutput, 'id'>;  // ✅ 复用zod推导的类型，只取id
            valideBody?: unknown;
        }
    }
}