import { AuthService } from "./auth.service";
import type { Request, Response } from "express";
import { AppError } from "../error/apperror";
import {valideRequest} from "../middleware/zod_check"
import { Apiresponse } from "../lib/api_response";
import jwt from "jsonwebtoken";
import { Redis } from "../lib/redis";
import { CookieOptions } from "express";

//version for middleware of zod, add token in cookie 
export class AuthController{
    
    constructor(private authservice: AuthService)
    {}

    private cookieOptions : CookieOptions = {
        httpOnly: true,
        // secure: process.env.NODE_ENV === 'production',	// JIANXIN
        sameSite: 'none',									// JIANXIN
		secure: true, // required for sameSite: 'none', cookies are ignored otherwise
        //sameSite: 'none', // for cross-site infrastructure
        //maxAge:  1 * 60 * 60 * 1000
    };

    register = async(req: Request, res: Response) =>{
        try{
            const {username, email, password } = req.validatedBody;
            const {token, user} = await this.authservice.register({username, email, password});
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
            const {email, password} = req.validatedBody;
            const {token, user} = await this.authservice.login({email, password})
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
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
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

    googleCallBack = async(req: Request, res: Response)=> {

        try{
            const {code} = req.query;
            console.log("======code=====", code);
            if (!code){
                return res.status(400).json({message: 'Authorization code not found in query'})
            }
            const result = await this.authservice.googleLogin(code as string);
            //add the token in cookie
            res.cookie('auth_token', result.token, this.cookieOptions);
            //redirection vers le front 
            res.redirect('https://localhost:8888/oauth/success')
        }catch(error){
            console.error('error in googlecallback: ', error);
                console.error('error stack:', (error as Error).stack);  // 加这行
            res.redirect('https://localhost:8888/oauth/error');
        }
    }

    getMe = async(req: Request, res: Response) => {
        try {
            const token = req.cookies?.auth_token;
            if (!token){
                return res.status(401).json(
                    Apiresponse.error('UNAUTHORIZED', 'No auth token provided')
                )
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
            const { UserRepository } = await import('../User/user.repository');
            const userRepo = new UserRepository();
            const user = await userRepo.find_by_id(decoded.id);
            
            if (!user) {
                return res.status(401).json(
                    Apiresponse.error("USER_NOT_FOUND", "User not found")
                );
            }

            res.json(user);
        } catch (error){
            console.error('Error in getMe: ', error);
            res.status(401).json(
                Apiresponse.error("UNAUTHORIZED", "Invalid auth token")
            )
        }
    }
}
