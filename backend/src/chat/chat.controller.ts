import { AppError, ErrorCode } from "src/error/apperror";
import { ChatService } from "./chat.service";
import { Apiresponse } from "src/lib/api_response";
import { Request, Response } from "express";

export class ChatController{
    constructor(
        private chatservice: ChatService
    ){}

    getHistory = async(req: Request, res: Response) => {
        const userId = req.user!.id;
        const {withUserId, limit, before} = req.valideBody;

        try{
            const messages = await this.chatservice.getHistory(Number(userId), withUserId, limit, before);
            return res.status(200).json(
                Apiresponse.success(messages, 'Histroy fetch')
            )

        }catch(error){
            console.error("error in chatcontroller: ", error);
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                )
            }
            return res.status(500).json(
                Apiresponse.error(ErrorCode.INTERNAL_ERROR, "Internal chat error")
            )
        }
    }
}