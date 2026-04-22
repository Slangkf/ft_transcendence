
export enum ErrorCode {

    //Authendification
    AUTH_UNAUTHORIZED = "AUTH_UNAUTHORIZED", //401
    AUTH_MAIL_ALREADY_EXIST = "AUTH_MAIL_ALREADY_EXIST", //401
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS", //409

    //Game
    GAME_NOT_FOUND = "GAME_NOT_FOUND", //404    
    GAME_ALREADY_FINISHED = "GAME_ALREADY_FINISHED", //409
    GAME_UNKOWN_MODE = "GAME_UNKOWN_MODE",//400
    GAME_FINISHED = "GAME_FINISHED",//409

    //Player
    PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND", //404
    PLAYER_ALREADY_ANSWERED = "ALREADY_ANSWERED", //409

    //Multi
    ROOM_NOT_AVAILABLE = "ROOM_NOT_AVAILABLE", //409
    ROOM_NOT_FOUND = "ROOM_NOT_FOUND",//404
    ROOM_FULL = "ROOM_FULL", //409
    ROOM_PLAYER_NBR = "ROOM_PLAYER_NBR", //400
    //Question
    QUESTION_NOT_FOUND = "QUESTION_NOT_FOUND", //404
    
    //System
    INTERNAL_ERROR = "INTERNAL_ERROR", //500
    FORBIDDEN = "FORBIDDEN", //403
    BAD_REQUEST = "BAD_REQUEST", //400
}

export class AppError extends Error {
    constructor(
        public message: string,
        public code: ErrorCode,
        public statusCode: number = 400,
        public details?: any
    ) {
        super(message);
        this.name = "AppError";
    }
}