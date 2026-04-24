import { UserService } from "./user.service";
import type { Request, Response } from "express";
import { AppError, ErrorCode } from "src/error/apperror";

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
}
/****
 * user profil: 
 *  - Users can update their profile information.
 *  - Users can upload an avatar (with a default avatar if none provided)
 *  - Users can add other users as friends and see their online status: realise by friendship service
 *  - Users have a profile page displaying their information.(done)
 * 
 * 
 */