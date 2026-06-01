import {UserRepository} from '../User/user.repository';
import type { LoginInput, RegisterInput, UserOutput, AuthResult, OAuthUser } from '@shared/user.schema';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {randomUUID} from 'crypto';
import { AppError, ErrorCode } from '../error/apperror';
import {Provider} from '@prisma/client';

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

        if (!user.password) {
        throw new AppError(
            'Please login with Google',
            ErrorCode.AUTH_INVALID_MAIL,
            401)
        }

        if (user.provider === Provider.GOOGLE){
            throw new AppError(
                'Please login with Google',
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

    async oauthLogin(provider: 'GOOGLE' | 'GITHUB', code: string): Promise<AuthResult>{
        let oauthUser;

        if (provider === 'GOOGLE') {
            oauthUser = await this.getGoogleUserInfo(code);
        } else if (provider === 'GITHUB') {
            oauthUser = await this.getGithubUserInfo(code);
        } else {
            throw new AppError('Invalid provider', ErrorCode.INVALID_PROVIDER, 400);
        }
        let user = await this.userrepository.find_by_oauth_id(provider, oauthUser.id);

        if (!user) {
            const email_exist = await this.userrepository.find_by_email(oauthUser.email);
            if (email_exist) {
                // link with the user 
                user = await this.userrepository.link_oauth(email_exist.id, {
                    provider,
                    oauthId: oauthUser.id,
                    url: email_exist.url ?? oauthUser.picture,
                });
            } else {
                // create a new user
                let username = oauthUser.name;
                const username_exist = await this.userrepository.find_by_username(username);
                if (username_exist) {
                    username = `${username}_${oauthUser.id.slice(0, 4)}`;
                }
                user = await this.userrepository.createByOAuth({
                    username,
                    email: oauthUser.email,
                    provider,
                    oauthId: oauthUser.id,
                    url: oauthUser.picture
                });
            }
        }

        const token = this.generateToken(user.id, user.username);
        return { token, user: this.formatUserOutput(user) };
    }

    private async getGoogleUserInfo(code: string): Promise<OAuthUser> {
        const tokenres = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                code,
                redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
                grant_type: 'authorization_code',
            }),
        });

        const tokenData = await tokenres.json();
        if (!tokenData.access_token) {
            throw new AppError('Failed to get Google access token', ErrorCode.OAUTH_FAILED, 400);
        }

        const userres = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const googleUser = await userres.json();

        return {
            id: googleUser.id,
            email: googleUser.email,
            name: googleUser.name,
            picture: googleUser.picture
        };
    }

    private async getGithubUserInfo(code: string): Promise<OAuthUser> {
        const tokenres = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID!,
                client_secret: process.env.GITHUB_CLIENT_SECRET!,
                code,
            }),
        });

        const tokenData = await tokenres.json();
        if (!tokenData.access_token) {
            throw new AppError('Failed to get GitHub access token', ErrorCode.OAUTH_FAILED, 400);
        }

        const userres = await fetch('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const githubUser = await userres.json();

        //get email 
        let email = githubUser.email;
        if (!email){
            const emailres = await fetch('https://api.github.com/user/emails',{
                headers: {Authorization: `Bearer ${tokenData.access_token}`,}
            })
            const emails = await emailres.json() as {email: string; primary: boolean }[];
            console.log("emails: ", emails);
            email = emails.find(e => e.primary)?.email ?? `${githubUser.id}@github.noemail`;
        }

        return {
            id: githubUser.id.toString(),
            email: email,
            name: githubUser.login,
            picture: githubUser.avatar_url
        };
    }

    private generateToken(userId: number, username: string): string {
        return jwt.sign(
            {
                id: userId,
                username,
                nickname: username,
                jti: randomUUID(),
            },
            JWT_SECRET!,
            { expiresIn: '24h' }
        );
    }

    private formatUserOutput(user: any): UserOutput {
        // remove information sensible
        const { password, role, googleId, githubId, provider, ...userOutput } = user;
        return userOutput as UserOutput;
    }
}