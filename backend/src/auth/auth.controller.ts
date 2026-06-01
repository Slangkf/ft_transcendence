import { AuthService } from "./auth.service";
import type { Request, Response } from "express";
import { AppError } from "../error/apperror";
import {valideRequest} from "../middleware/zod_check"
import { Apiresponse } from "../lib/api_response";
import jwt from "jsonwebtoken";
import { Redis } from "../lib/redis";
import { CookieOptions } from "express";
import { access } from "fs";

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

    githubCallback = async(req: Request, res: Response) => {
        


        const code = req.query.code as string;
        try{
            const tokenres = await fetch('https://github.com/login/oauth/access_token',
                {method: 'POST',
                headers: {'Accept': 'application/json', 
                        'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: process.env.GITHUB_CLIENT_ID,
                    client_secret: process.env.GITHUB_CLIENT_SECRET,
                    code,})
                })
            const token_github = await tokenres.json() as {access_token: string};
            console.log("token: ", token_github);

            //get the profil of user with the token 
            const profilres = await fetch('https://api.github.com/user', {
                headers: {
                    Authorization: `token ${token_github.access_token}`,
                                Accept: 'application/vnd.github+json',
                }
            })
            const profil = await profilres.json() as {id: number; login: string; email:string};

            //get email 
            let email = profil.email;
            if (!email){
                const emailres = await fetch('https://api.github.com/user/emails',{
                    headers: {
                        Authorization: `token ${token_github.access_token}`,
                                    Accept: 'application/vnd.github+json'}
                })
                const emails = await emailres.json() as {email: string; primary: boolean }[];
                console.log("emails: ", emails);
                email = emails.find(e => e.primary)?.email ?? `${profil.id}@github.noemail`;
            }

            const {token, user} = await this.authservice.loginOrCreateOAuth({
                githubId: String(profil.id),
                username: profil.login,
                email,
            })
            res.cookie('auth_token', token, this.cookieOptions);
            res.redirect('https://localhost:8888/oauth/success');
        }catch(error){
            console.error("error in callback: ", error);
            res.redirect('https://localhost:8888/oauth/error');
        }
    }

    getMe = async(req: Request, res: Response) => {
        try{
            const token = req.cookies?.auth_token;
            if (!token) {
                return res.status(401).json(Apiresponse.error("UNAUTHORIZED", "No auth token provided"));
            }
            jwt.verify(token, process.env.JWT_SECRET!);

            const decoded = jwt.decode(token) as jwt.JwtPayload;
            res.json({user: decoded});
        }catch(error){
            res.status(401).json(Apiresponse.error("UNAUTHORIZED", "Invalid auth token"));
        }
    }
}
