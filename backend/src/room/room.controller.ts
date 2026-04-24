import { Apiresponse } from "src/lib/api_response";
import { RoomManager } from "./room.manager";
import {Request, Response} from 'express'
import { AppError, ErrorCode } from "src/error/apperror";


export class RoomController{
    constructor(private roommanager: RoomManager){
    }

    EntryRoom = async (req: Request, res: Response)=>{
        try{
            const {type, nickname, targetId, roomId } = req.body;
            const result = await this.roommanager.entry(type,{
                userId: req.user.id,
                nickname,
                targetId: targetId || roomId,
            })
            return res.status(200).json(
                Apiresponse.success(result, "success to join a room")
            )
        }catch (error){            
                if(error instanceof AppError){
                    return res.status(error.statusCode).json(
                        Apiresponse.error(error.code, error.message)
                    )
                }
                return res.status(500).json(
                    Apiresponse.error(ErrorCode.INTERNAL_ERROR, "Internal EntryRoom error")
                )
            }
    }

}
/****
 *  room input: 
 *      need to get the mode for the chat or for the different strategie 
 * 
 * 
 * 
 * 
 * 
 */