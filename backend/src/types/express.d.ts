
import 'express'

export interface UserPayload {
    id: string
    username: string
    jti: string
}

declare module 'express-serve-static-core' {
   
    interface Request {
        user?: UserPayload;
        validatedBody?: any;
    }
  
}

export{}