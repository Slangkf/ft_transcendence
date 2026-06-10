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
        sameSite: 'lax', // même origine (tout passe par nginx:8888) → pas de cross-site, fonctionne via IP distante
        secure: true,    // site servi uniquement en HTTPS
        //maxAge:  1 * 60 * 60 * 1000
    };

    /*
     * POST /register handler. Registers the user, sets the auth_token cookie,
     * and returns the created user (201). Maps AppError to its status/code.
     */
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

    /*
     * POST /login handler. Authenticates the user, sets the auth_token cookie,
     * and returns the user. Maps AppError to its status/code.
     */
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
    
    /*
     * POST /logout handler. Sets the user OFFLINE, blacklists the JWT's jti in
     * Redis until its expiry, and clears the auth_token cookie. Token errors are
     * swallowed so logout always succeeds.
     */
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
}
