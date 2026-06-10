import { AppError, ErrorCode } from "../error/apperror";
import { Apiresponse } from "../lib/api_response";
import { ChatService } from "./chat.service";
import { Request, Response } from "express";

export class ChatController{
    constructor(
        private chatservice: ChatService
    ){}

    /* GET /chat/history/:withUserId handler. Returns the conversation with another user. */
    getHistory = async(req: Request, res: Response) => {
        const userId = req.user!.id;
        const {withUserId, limit, before} = req.validatedBody;

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

    /* GET /chat/unread handler. Returns the caller's unread message count per sender. */
    getUnreadCount = async(req: Request, res: Response) => {
        const userId = req.user!.id;

        try{
            const unread = await this.chatservice.getUnreadCountPerSender(Number(userId));
            return res.status(200).json(
                Apiresponse.success(unread, "unread count fetched")
            );

        }catch(error){
            console.error("error in getUnreadCount: ", error);
            if (error instanceof AppError){
                return res.status(error.statusCode).json(
                    Apiresponse.error(error.code, error.message)
                )
            }
            return res.status(500).json(
                Apiresponse.error(ErrorCode.INTERNAL_ERROR, "Internal unreadcount error")
            )
        }
    }
}