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

    ChangePassword = async(req: Request, res: Response) => {
        try{
            const result = await this.userservice.change_password(req.user.id, req.body);
            if (result){
                //clear old token 
                res.clearCookie('auth_token', {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'strict'
                })
                //need to login again
                res.json({
                    requireRelogin: true,
                    message: "Password change success, please login again"
                })
            }
        }catch(error){
            if (error instanceof AppError){
                return res.status(error.statusCode).json({message: error.message})
            }
            res.status(500).json({message: "Internal changepassword error"})
        }
    }

    UpdateAvatar = async(req: Request, res: Response) => {
        try{
            const result = await this.userservice.update_avatar(req.user.id, req.file);
            res.json(result);
        }catch(error){
            if (error instanceof AppError){
                return res.status(error.statusCode).json({message: error.message})
            }
            res.status(500).json({message: "Internal avatar update error"})
        }
    }
}
