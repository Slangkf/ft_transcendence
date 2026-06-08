import {z, ZodSchema} from 'zod'
import type {Request, Response, NextFunction } from 'express'

/**
 * validated request data using a Zod schema
 * Data from:
 * - req.body
 * - req.params
 * - req.query
 *
 * is merged and validated against the provided schema.
 *
 * On success, the parsed and type-safe data is attached to
 * req.validatedBody for use in controllers.
 * @param schema 
 * @returns 
 */
export const valideRequest = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse({
            ...req.body,
            ...req.params,
            ...req.query,
        })
        if (!result.success){
            console.log(result.error.format())
            return res.status(400).json({errors: result.error.flatten()})
        }
        req.validatedBody = result.data
        next()
    }
}

//zod check will put all information from req body params and query into valideBody, to use in controller for the check 
