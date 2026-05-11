import type { UserOutput } from '@shared/user.schema';

declare global {
    namespace Express {
        interface UserPayload {
            id: string;
            username: string;
        }

        interface Request {
            user: UserPayload;
        }
    }
}
export {}