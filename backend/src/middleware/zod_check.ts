import {z, ZodSchema} from 'zod'
import type {Request, Response, NextFunction } from 'express'

export const valideRequest = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body)
        if (!result.success){
            return res.status(400).json({errors: result.error.flatten()})
        }
        req.valideBody = result.data
        next()
    }
}
