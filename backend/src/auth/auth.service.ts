import {UserRepository} from '../User/user.repository';
import type { LoginInput, RegisterInput, UserOutput, AuthResult } from '@shared/user.schema';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {randomUUID} from 'crypto';
import { AppError, ErrorCode } from '../error/apperror';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
}

export  class AuthService{

    constructor( private userrepository: UserRepository)
    {}
    
    /*
     * Registers a new user.
     * - Rejects if the email or username is already taken (409 AppError).
     * - Creates the user, then signs a 24h JWT (with a unique jti).
     * - Returns the token and the created user.
     */
    async register(input: RegisterInput):Promise<AuthResult>{
    //1. check mail or username existe
    //2. create with repository 
    //3. generate jwt token update in useroutput and return 
    const mail_exist = await this.userrepository.find_by_email(input.email)
    if (mail_exist){
        throw new AppError(
            'Email address already registered', 
            ErrorCode.AUTH_MAIL_ALREADY_EXIST,
            409,
            {email: input.email})
    }

    const username_exist = await this.userrepository.find_by_username(input.username)
    if (username_exist){
        throw new AppError(
            'Username already used', 
            ErrorCode.AUTH_USERNAME_ALREADY_EXIST,
            409,
            {username: input.username})
    }

    const newuser = await this.userrepository.create(input)
    const token = jwt.sign(
        {
            id: newuser.id,
            username: newuser.username,
            nickname: newuser.username,
            jti: randomUUID(),
        },
        JWT_SECRET!,
        {expiresIn: '24h'}
    )
    return {
        token,
        user: newuser,}
    }

    /*
     * Authenticates a user by email + password.
     * - Throws on unknown email or wrong password (401 AppError).
     * - Sets the user ONLINE, signs a 24h JWT, and returns it with the user.
     */
    async login(input: LoginInput): Promise<AuthResult>{
        //1. find the user bye mail or username
        const user = await this.userrepository.find_by_email(input.email);
        if (!user){
            throw new AppError(
                'Invalid email', 
                ErrorCode.AUTH_INVALID_MAIL,
                401)
        }

        //2. if exite check the password 
        const valide_password = await bcrypt.compare(input.password, user.password);
        if (!valide_password){
            throw new AppError (
                'Invalid password', 
                ErrorCode.AUTH_INVALID_PASSWORD,
                401)
        }
        await this.userrepository.update_status(user.id, 'ONLINE');
        //3. get a jwt token 
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                nickname: user.username,
                jti: randomUUID()
            },
            JWT_SECRET!,
            {expiresIn: '24h'}
        )
        //return data with token
        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                url: user.url,
                score: user.score,
                wins: user.wins,
                friendsNb: user.friendsNb,
                status: 'ONLINE',
                createdAt: user.createdAt
            }
        }
    }
}
