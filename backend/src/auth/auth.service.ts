import {UserRepository} from '../User/user.repository';
import type { LoginInput, RegisterInput, UserOutput, AuthResult } from '@shared/user.schema';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError, ErrorCode } from 'src/error/apperror';
import {randomUUID} from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
}

export  class AuthService{

    constructor( private userrepository: UserRepository)
    {}
    
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
            jti: randomUUID(),
        },
        JWT_SECRET,
        {expiresIn: '7d'}
    )
    return {
        token,
        user: newuser,}
    }

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
                jti: randomUUID()
            },
            JWT_SECRET,
            {expiresIn: '7d'}
        )
        //return data with token
        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                url: user.url,
                wins: user.wins,
                losses: user.losses,
                friendsNb: user.friendsNb,
                status: 'ONLINE'
            }
        }
    }
}
