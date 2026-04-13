import { AuthService } from "./auth.service";
import type { Request, Response } from "express";
import  { Register_Input, Login_Input  } from "@shared/user.schema";
import { AppError } from "src/error/apperror";
import {valideRequest} from "../middleware/zod_check"

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

//version for middleware of zod 
export class AuthController{
    private authservice: AuthService;
    constructor(){
        this.authservice = new AuthService();
    }

    register = async(req: Request, res: Response) =>{
        try{
            const result = await this.authservice.register(req.valideBody)
            res.status(201).json(result)
        }catch(error){
            if (error instanceof AppError){
                return res.status(error.statusCode).json({message: error.message})
            }
            res.status(500).json({message: "Internal server error for register"})
        }
    }

    login = async(req: Request, res: Response) =>{
        try{
            const result = await this.authservice.login(req.valideBody)
            res.json(result);
            
        }catch(error) {
            if (error instanceof AppError){
                return res.status(error.statusCode).message({message: error.message})
            }
            res.status(500).json({message: "Internal Server error for login"})
        }
    }
}