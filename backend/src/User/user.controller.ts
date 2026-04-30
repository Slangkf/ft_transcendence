import { UserService } from "./user.service";
import type { Request, Response } from "express";
import { AppError, ErrorCode } from "src/error/apperror";
import { Apiresponse } from "src/lib/api_response";

export class UserController{
    private userservice: UserService
    constructor(){
        this.userservice = new UserService()
    }

    GetProfil = async(req: Request, res: Response)=>{
        try{
            const result = await this.userservice.get_profile(req.user.id);
            res.json(result)

        }catch(error) {
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                    )
            }
            res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal GetProfil controler error")
                )
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
        }catch(error) {
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                    )
            }
            res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal ChangePassword controler error")
                )
        }
    }

    ChangeUsername = async (req: Request, res: Response) => {
        try {
            const result = await this.userservice.change_username(req.user.id, req.body);
            res.json(result);
        }catch(error) {
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                    )
            }
            res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal ChangeUrsername controler error")
                )
        }
    }

    UpdateAvatar = async(req: Request, res: Response) => {
        try{
            const result = await this.userservice.update_avatar(req.user.id, req.file);
            res.json(result);
        }catch(error) {
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                    )
            }
            res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal UpdateAvatar controler error")
                )
        }
    }
}
