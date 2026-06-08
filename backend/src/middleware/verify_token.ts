import jwt from 'jsonwebtoken'
import type {Request, Response, NextFunction } from 'express'
import dotenv from 'dotenv';
dotenv.config();

import { Redis } from '../lib/redis';
import { User } from '@prisma/client';
import { AppError, ErrorCode } from '../error/apperror';
import { UserPayload } from '../types/express';
import {prisma} from '../lib/prisma';

/**
 * Authentication middleware 
 * @description 
 * - extract JWT from cookies or Authorization header
 * - verfify token signature and validity
 * - check whether the token has been revoked(blacklist)
 * - ensure the user still exists in the databse
 * - attach authenticated user information to the request 
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
export const verifyToken = async(req: Request, res: Response, next: NextFunction)=>{
	// check either the cookie or the Authorization header
    const token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];
    if (!token){
        return next(new AppError(
            "Not authenticated",
            ErrorCode.AUTH_UNAUTHORIZED,
            401
        ))
    }

    try{
        // vertify JWT signature and decode payload 
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload
        
        //check the token has been revoked in blacklist
        const exist = await Redis.get(`blacklist:${decoded.jti}`);
        if (exist){
            return next(new AppError(
            "Token in blacklist",
            ErrorCode.AUTH_UNAUTHORIZED,
            401
        ))}
        //check if the user found in database
        const user = await prisma.user.findUnique({
            where: {id: Number(decoded.id)},
            select:{ id: true, username: true}
        })
        if (!user){
            return next(new AppError("User no longer exist", ErrorCode.AUTH_UNAUTHORIZED));
        }

        // attach authenticated user information in request object 
        req.user = {
            ...decoded,
            username: user.username
        }
        next()
    }catch(error){
        return next(new AppError(
            "Invalide token",
            ErrorCode.AUTH_UNAUTHORIZED,
            401
        ))
    }
}
