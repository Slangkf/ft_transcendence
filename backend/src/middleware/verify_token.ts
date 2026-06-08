import jwt from 'jsonwebtoken'
import type {Request, Response, NextFunction } from 'express'
import dotenv from 'dotenv';
dotenv.config();

import { Redis } from '../lib/redis';
import { User } from '@prisma/client';
import { AppError, ErrorCode } from '../error/apperror';
import { UserPayload } from '../types/express';
import {prisma} from '../lib/prisma';

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
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload
        
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
