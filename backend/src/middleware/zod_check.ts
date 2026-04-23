import {z, ZodSchema} from 'zod'
import type {Request, Response, NextFunction } from 'express'
import { AppError, ErrorCode } from 'src/error/apperror'

export const valideRequest = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body)
        if (!result.success){
            return res.status(400).json({message: result.error.flatten()})
        }
        req.valideBody = result.data
        next()
    }
}
