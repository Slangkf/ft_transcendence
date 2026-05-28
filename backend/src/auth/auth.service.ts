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

    async googleLogin(code: string): Promise<AuthResult>{
        //1. echange code contre un token
        const tokenres = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                code,
                redirect_uri: process.env.GOOGLE_REDIRECT_URL!,
                grant_type: 'authorization_code',
            }),
        });
        const {access_token} = await tokenres.json();

        //get the information with token 
        const userres = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {Authorization: `Bearer ${access_token}`}
        })
        const googleUser = await userres.json();

        //check googleid, if not found, check with email
        let user = await this.userrepository.find_by_google_id(googleUser.id);
        if (!user){
            //check with the email
            const email_exist = await this.userrepository.find_by_email(googleUser.email);
            if (email_exist){
                //link the user with google mail
                user = await this.userrepository.link_google(email_exist.id, {
                    googleId: googleUser.id,
                    provider: 'GOOGLE',
                    url: email_exist.url ?? googleUser.picture,
                }
                );
            } else {
                //check with the username
                let username = googleUser.name
                const username_exist = await this.userrepository.find_by_username(username);
                if (username_exist){
                    //get a new username for the user
                    username = `${username}_${googleUser.id.slice(0,4)}`
                }
                user = await this.userrepository.createByGoogle({
                    username,
                    email: googleUser.email,
                    provider: Provider.GOOGLE,
                    googleId: googleUser.id,
                    url: googleUser.picture
                })
            }
        }

        //jwt 
        const token = jwt.sign({
            id: user.id,
            username: user.username,
            nickname: user.username,
            jti: randomUUID(),
        },
        JWT_SECRET!,
        {expiresIn: '24h'},
        )

        return {token, user};
    }
}
