import { AuthService } from "./auth.service";
import type { Request, Response } from "express";
import  { Register_Input, Login_Input  } from "@shared/user.schema";
import { AppError } from "src/error/apperror";
import {valideRequest} from "../middleware/zod_check"
import { Apiresponse } from "src/lib/api_response";

//version for middleware of zod, add token in cookie 
export class AuthController{
    private authservice: AuthService;
    constructor(){
        this.authservice = new AuthService();
    }

    private cookieOptions = {
        httpOnly: true,
        // secure: process.env.NODE_ENV === 'production',	// JIANXIN
        // sameSite: 'lax',									// JIANXIN
		secure: true, // required for sameSite: 'none', cookies are ignored otherwise
        sameSite: 'none', // for cross-site infrastructure
        maxAge: 7 * 24 * 60 * 60 * 1000
    };

    register = async(req: Request, res: Response) =>{
        try{
            const {token, user} = await this.authservice.register(req.valideBody)
            res.cookie('auth_token', token, this.cookieOptions);
            res.status(201).json(
                Apiresponse.success(user, "success to registe")
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
        try{
            res.clearCookie('auth_token');
            //await redis.set(
            //    `blacklist: ${jti}`,
            //    "1",
            //    "EX",
            //    7 * 24 * 60 * 60
            //)
            return res.json(
                Apiresponse.success(null, "Logged out")
            )
        }catch(error){
            return res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Logout failed")
            )
        }
    }
    //logout need check redis 
}