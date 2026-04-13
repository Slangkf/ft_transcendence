import { UserService } from "./user.service";
import type { Request, Response } from "express";
import { AppError } from "src/error/apperror";

export class UserController{
    private userservice: UserService
    constructor(){
        this.userservice = new UserService()
    }

    GetProfil = async(req: Request, res: Response)=>{
        try{
            const result = await this.userservice.get_profile(req.user.id);
            res.json(result)

        }catch(error){
            if (error instanceof AppError){
                return res.status(error.statusCode).json({message: error.message})
            }
            res.status(500).json({message: "Internal profil error"})
        }
    }
}