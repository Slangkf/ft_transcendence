import { AuthService } from "./auth.service";
import type { Request, Response } from "express";
import { AppError } from "src/error/apperror";
import {valideRequest} from "../middleware/zod_check"
import { Apiresponse } from "src/lib/api_response";
import jwt from "jsonwebtoken";
import { Redis } from "../lib/redis";

//version for middleware of zod, add token in cookie 
export class AuthController{
    
    constructor(private authservice: AuthService)
    {}

    private cookieOptions = {
        httpOnly: true,
        // secure: process.env.NODE_ENV === 'production',	// JIANXIN
         sameSite: 'lax',									// JIANXIN
		secure: true, // required for sameSite: 'none', cookies are ignored otherwise
        //sameSite: 'none', // for cross-site infrastructure
        maxAge: 7 * 24 * 60 * 60 * 1000
    };

    register = async(req: Request, res: Response) =>{
        try{
            const {token, user} = await this.authservice.register(req.valideBody)
            res.cookie('auth_token', token, this.cookieOptions);
            res.status(201).json(
                Apiresponse.success(user, "success to register")
                );
        }catch(error){
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                    )
            }
            res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal register error")
                )
        }
    }

    login = async(req: Request, res: Response) =>{
        try{
            const {token, user} = await this.authservice.login(req.valideBody)
            res.cookie('auth_token', token, this.cookieOptions);
            res.json(user);
            
        }catch(error) {
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                    )
            }
            res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal login error")
                )
        }
    }
    
    logout = async(req: Request, res: Response) => {
        const token = req.cookies?.auth_token;

        try {
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET) as jwt.JwtPayload;
                const jti = decoded.jti;
                const exp = decoded.exp;

                if (decoded.id) {
                    const { UserRepository } = await import('../User/user.repository');
                    const userRepo = new UserRepository();
                    await userRepo.update_status(decoded.id as number, 'OFFLINE');
                }

                if (jti && exp) {
                    const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 1);
                    await Redis.set(`blacklist:${jti}`, "1", { EX: ttl });
                }
            }
        } catch (error) {
            console.log("logout token ignored:", error);
        }

        res.clearCookie('auth_token', this.cookieOptions);
        res.json({message: "Logged out"})
    }
}
