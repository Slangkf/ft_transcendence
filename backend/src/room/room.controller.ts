import { Apiresponse } from "src/lib/api_response";
import { RoomManager } from "./room.manager";
import {Request, Response} from 'express'
import { AppError, ErrorCode } from "src/error/apperror";


export class RoomController{
    constructor(private roommanager: RoomManager){
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