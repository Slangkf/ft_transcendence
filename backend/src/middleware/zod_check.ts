import {z, ZodSchema} from 'zod'
import type {Request, Response, NextFunction } from 'express'
import { AppError, ErrorCode } from 'src/error/apperror'

export const valideRequest = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body)
        if (!result.success){
            return next(new AppError(
                "Zod check error",
                ErrorCode.BAD_REQUEST,
                400
            ))
        }
        req.valideBody = result.data
        next()
    }
}
