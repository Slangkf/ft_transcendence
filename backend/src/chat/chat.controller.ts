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
        const withUserId = req.params.withUserId;
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const before = req.query.before? new Date(req.query.before as string) : undefined;

        if (!withUserId){
            return res.status(400).json(
                Apiresponse.error(ErrorCode.INVALID_USER_ID, 'invalide userId')
            )
        }
        try{
            const messages = await this.chatservice.getHistory(userId, withUserId, limit, before);
            return res.status(200).json(
                Apiresponse.success(messages, 'Histroy fetch');
            )

        }catch(error){
            console.error("error in chatcontroller: ", error);
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message);
                )
            }
            return res.status(500).json(
                Apiresponse.error(ErrorCode.INTERNAL_ERROR, "Internal chat error");
            )
        }
    }
}