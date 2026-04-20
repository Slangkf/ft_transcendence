import { AuthService } from "./auth.service";
import type { Request, Response } from "express";
import { AppError } from "src/error/apperror";
import jwt from "jsonwebtoken";
import { redis } from "../lib/redis";

//export  class AuthController{
//    private authservice: AuthService
//
//    constructor(){
//        this.authservice = new AuthService();
//    }
//
//    register = async(req: Request, res: Response)=> {
//        const parsed = Register_Input.safeParse(req.body);
//        if (!parsed.success){
//            return res.status(400).json({errors: parsed.error.flatten()})
//        }
//
//        try{
//            const result = await this.authservice.register(parsed.data);
//            res.status(201).json(result)
//        }catch(error){
//            if (error instanceof AppError){
//                return res.status(error.statusCode).json({message: error.message})
//            }
//            res.status(500).json({message: "Internal server error"})
//        }
//    }
//
//    login = async(req: Request, res: Response)=>{
//        const parsed = Login_Input.safeParse(req.body);
//        if (!parsed.success){
//            return res.status(400).json({errors: parsed.error.flatten()})
//        }
//
//        try{
//            const result = await this.authservice.login(parsed.data);
//            res.json(result)
//        } catch(error){
//            if (error instanceof AppError){
//                return res.status(error.statusCode).json({message: error.message})
//            }
//            res.status(500).json({message: "Internal server error"})
//        }
//    }
//}

//version for middleware of zod, add token in cookie 
export class AuthController{
    private authservice: AuthService;
    constructor(){
        this.authservice = new AuthService();
    }

    private cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    };

    register = async(req: Request, res: Response) =>{
        try{
            const {token, user} = await this.authservice.register(req.valideBody)
            res.cookie('auth_token', token, this.cookieOptions);
            res.status(201).json(user);
        }catch(error){
            console.log("error in control: ", error);
            if (error instanceof AppError){
                return res.status(error.statusCode).json({message: error.message})
            }
            res.status(500).json({message: "Internal server error for register"})
        }
    }

    login = async(req: Request, res: Response) =>{
        try{
            const {token, user} = await this.authservice.login(req.valideBody)
            res.cookie('auth_token', token, this.cookieOptions);
            res.json(user);
            
        }catch(error) {
            if (error instanceof AppError){
                return res.status(error.statusCode).json({message: error.message})
            }
            res.status(500).json({message: "Internal Server error for login"})
        }
    }
    
    logout = async(req: Request, res: Response) => {
        const token = req.cookies?.auth_token;

        try {
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET) as jwt.JwtPayload;
                const jti = decoded.jti;
                const exp = decoded.exp;

                if (jti && exp) {
                    const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 1);
                    await redis.set(`blacklist:${jti}`, "1", { EX: ttl });
                }
            }
        } catch (error) {
            console.log("logout token ignored:", error);
        }

        res.clearCookie('auth_token', this.cookieOptions);
        res.json({message: "Logged out"})
    }
}
