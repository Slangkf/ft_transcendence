import { AuthService } from "./auth.service";
import type { Request, Response } from "express";
import  { Register_Input, Login_Input  } from "@shared/user.schema";

export  class AuthController{
    private authservice: AuthService

    constructor(){
        this.authservice = new AuthService();
    }

    register = async(req: Request, res: Response)=> {
        const parsed = Register_Input.safeParse(req.body);
        if (!parsed.success){
            return res.status(400).json({errors: parsed.error.flatten()})
        }

        try{
            const result = await this.authservice.register(parsed.data);
            res.status(201).json({result})
        }catch(error){
            const err = error as Error;
            res.status(400).json({message: err.message})
        }
    }

    login = async(req: Request, res: Response)=>{
        const parsed = Login_Input.safeParse(req.body);
        if (!parsed.success){
            return res.status(400).json({errors: parsed.error.flatten()})
        }

        try{
            const result = await this.authservice.login(parsed.data);
            res.json(result)
        } catch(error){
            const err = error as Error;
            res.status(401).json({message: err.message })
        }
    }
}