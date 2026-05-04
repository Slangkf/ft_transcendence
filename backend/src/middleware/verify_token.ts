import jwt from 'jsonwebtoken'
import type {Request, Response, NextFunction } from 'express'
import dotenv from 'dotenv';
dotenv.config();

import { redis } from '../lib/redis';
import { AppError, ErrorCode } from 'src/error/apperror';

export const verifyToken = async(req: Request, res: Response, next: NextFunction)=>{
	// check either the cookie or the Authorization header
    console.log("auth token: ", req.cookies.auth_token);
    console.log("header token: ", req.headers.authorization);
    const token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];
    if (!token){
        return next(new AppError(
            "Not authenticated",
            ErrorCode.AUTH_UNAUTHORIZED,
            401
        ))
    }

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        
        const exist = await redis.get(`blacklist:${decoded.jti}`);
        if (exist){
            return next(new AppError(
            "Token in blacklist",
            ErrorCode.AUTH_UNAUTHORIZED,
            401
        ))}
        req.user = decoded
        next()
    }catch(error){
        return next(new AppError(
            "Invalide token",
            ErrorCode.AUTH_UNAUTHORIZED,
            401
        ))
    }
}
