import { AuthService } from "./auth.service";
import type { Request, Response } from "express";
import { AppError } from "../error/apperror";
import {valideRequest} from "../middleware/zod_check"
import { Apiresponse } from "../lib/api_response";
import jwt from "jsonwebtoken";
import { Redis } from "../lib/redis";
import { CookieOptions } from "express";
import { randomUUID } from "node:crypto";

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

    googleCallBack = async (req: Request, res: Response) => {
        try {
            const { code } = req.query;
            if (!code) {
                return res.status(400).json({ message: 'Authorization code not found' });
            }
            const result = await this.authservice.oauthLogin('GOOGLE', code as string);
            res.cookie('auth_token', result.token, this.cookieOptions);
            res.redirect('https://localhost:8888/oauth/success?provider=Google');
        } catch (error) {
            console.error('error in google callback:', error);
            res.redirect('https://localhost:8888/oauth/error?provider=Google');
        }
    }

    githubCallBack = async (req: Request, res: Response) => {
        try {
            const { code } = req.query;
            if (!code) {
                return res.status(400).json({ message: 'Authorization code not found' });
            }
            // ✅ 统一调用，只改 provider 参数
            const result = await this.authservice.oauthLogin('GITHUB', code as string);
            res.cookie('auth_token', result.token, this.cookieOptions);
            res.redirect('https://localhost:8888/oauth/success?provider=Github');
        } catch (error) {
            console.error('error in github callback:', error);
            res.redirect('https://localhost:8888/oauth/error?provider=Github');
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

    google = async(req: Request, res: Response)=> {
        const url = 'https://accounts.google.com/o/oauth2/v2/auth';
        const options = {
            client_id: process.env.GOOGLE_CLIENT_ID!,
            redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
            response_type: 'code',
            //scope: tell what type of information we will get
            scope: [
                'openid',
                'email',
                'profile'
            ].join(' '),
            state: randomUUID(),
        }
        const qs = new URLSearchParams(options).toString();
        return res.redirect(`${url}?${qs}`)
    }

    github = async(req: Request, res: Response) => {
        const url_base  = "https://github.com/login/oauth/authorize";

        const params = new URLSearchParams({
            client_id : process.env.GITHUB_CLIENT_ID!,
            redirect_uri : process.env.GITHUB_CALLBACK_URL!,
            scope: 'read:user user:email',

        })
        return res.redirect(`${url_base}?${params.toString()}`);
    }
}
