
export enum ErrorCode {

    //Authendification
    AUTH_UNAUTHORIZED = "AUTH_UNAUTHORIZED",
    AUTH_MAIL_ALREADY_EXIST = "AUTH_MAIL_ALREADY_EXIST",
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS",

    //Game
    GAME_NOT_FOUND = "GAME_NOT_FOUND",
    GAME_ALREADY_FINISHED = "GAME_ALREADY_FINISHED",
    GAME_UNKOWN_MODE = "GAME_UNKOWN_MODE",
    

    //Player
    PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND",

    //SOLO 
    SOLO_GAME_NOT_FOUND = "SOLO_GAME_NOT_FOUND",

    //Multi
    
    //Question
    QUESTION_NOT_FOUND = "QUESTION_NOT_FOUND",

    //System
    INTERNAL_ERROR = "INTERNAL_ERROR",
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