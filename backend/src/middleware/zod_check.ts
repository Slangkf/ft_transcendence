import {z, ZodSchema} from 'zod'
import type {Request, Response, NextFunction } from 'express'

export const valideRequest = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse({
            ...req.body,
            ...req.params,
            ...req.query,
        })
        if (!result.success){
            return res.status(400).json({errors: result.error.flatten()})
        }
        req.valideBody = result.data
        next()
    }
}

//zod check will put all information from req body params and query into valideBody, to use in controller for the check 
