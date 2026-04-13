import jwt from 'jsonwebtoken'
import type {Request, Response, NextFunction } from 'express'
import dotenv from 'dotenv';
dotenv.config();

export const verifyToken = (req: Request, res: Response, next: NextFunction)=>{
    const token =  req.cookies.auth_token;

    if (!token){
        return res.status(401).json({message: "not login"})
    }

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        next()
    }catch {
        res.status(401).json({message: "token is unvalide"})
    }
}

//verifie token for profil 