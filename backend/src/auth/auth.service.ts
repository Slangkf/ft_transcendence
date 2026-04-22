import {UserRepository} from '../User/user.repository';
import type { LoginInput, RegisterInput, UserOutput, AuthResult } from '@shared/user.schema';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from 'src/error/apperror';
import {randomUUID} from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;

export  class AuthService{
    private userrepository: UserRepository;

    constructor(){
        this.userrepository = new UserRepository();
    }
    
    async register(input: RegisterInput):Promise<AuthResult>{
    //1. check mail or username existe
    //2. create with repository 
    //3. generate jwt token update in useroutput and return 
    const existEmail = await this.userrepository.find_by_identifiant(input.email)
    if (existEmail){
        throw new AppError('email already exist in user',409)
    }

    const existUsername = await this.userrepository.findByUsername(input.username)
    if (existUsername)
        throw new AppError('username already exist in user', 409)

    const newuser = await this.userrepository.create(input)
    const JWT_SECRET = process.env.JWT_SECRET;
    const token = jwt.sign(
        {
            id: newuser.id,
            jti: randomUUID()
        },
        JWT_SECRET,
        {expiresIn: '7d'}
    )
    console.log("in service, user: ",newuser);
    return {
        token,
        user: newuser}
    }

    async login(input: LoginInput): Promise<AuthResult>{
        //1. find the user bye mail or username
        const user = await this.userrepository.find_by_identifiant(input.email);
        if (!user){
            throw new AppError('Invalid credentials', 401)
        }

        //2. if exite check the password 
        const valide_password = await bcrypt.compare(input.password, user.password);
        if (!valide_password){
            throw new AppError ("Invalid credentials", 401)
        }
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
                friendsNb: user.friendsNb
            }
        }
    }
}
