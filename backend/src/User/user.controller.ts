import { AppError } from "../error/apperror";
import { Apiresponse } from "../lib/api_response";
import { UserService } from "./user.service";
import type { Request, Response } from "express";

export class UserController{
    
    constructor(private userservice: UserService)
    {}

    GetProfil = async(req: Request, res: Response)=>{
        try{
            const result = await this.userservice.get_profile(Number(req.user!.id));
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
    
    GetProfilById = async(req: Request, res: Response)=>{
        try{
            const {userId} = req.validatedBody;
            const result = await this.userservice.get_profile(userId);
            res.json(result)

        }catch(error) {
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                    )
            }
            res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal GetProfilbyId controler error")
                )
        }
    }

    GetProfilByUsername = async(req: Request, res: Response)=>{
        try{
            const {username} = req.validatedBody;
            
            const result = await this.userservice.get_profile_by_username(username);
            res.json(result)

        }catch(error) {
            console.error("error in  GetProfilByUsername: ", error);
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                    )
            }
            res.status(500).json(
                Apiresponse.error("INTERNAL_ERROR", "Internal GetProfilByUsername controler error")
                )
        }
    }

    ChangePassword = async(req: Request, res: Response) => {
        try{
            console.log("body recu in changepassword: ", req.body);
            const { oldpassword, newpassword, confirmpd } = req.validatedBody; // ← pas .input
            const result = await this.userservice.change_password(Number(req.user!.id), { oldpassword, newpassword, confirmpd })
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
            const {newUsername} = req.validatedBody; 
            const result = await this.userservice.change_username(Number(req.user!.id), {newUsername});
            res.json(result);
        }catch(error) {
            console.error();
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
            const result = await this.userservice.update_avatar(Number(req.user!.id), req.file);
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
