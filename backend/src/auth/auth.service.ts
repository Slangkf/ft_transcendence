import {UserRepository} from '../User/user.repositery';
import type { LoginInput, RegisterInput, UserOutput, AuthResult } from '@shared/user.schema';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from 'src/error/apperror';


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
    const exist_already = await this.userrepository.find_by_identifiant(input.email)
    if (exist_already){
        throw new AppError('email already existe in user',409)
    }

    const newuser = await this.userrepository.create(input)
    const JWT_SECRET = process.env.JWT_SECRET;
    const token = jwt.sign(
        {id: newuser.id},
        JWT_SECRET,
        {expiresIn: '7d'}
    )
    return {
        token,
        ...newuser
    }
    }

    async login(input: LoginInput): Promise<AuthResult>{
        //1. find the user bye mail or username
        const user = await this.userrepository.find_by_identifiant(input.email);
        if (!user){
            throw new AppError('user not existe', 409)
        }

        //2. if exite check the password 
        const valide_password = await this.userrepository.verify_password(input.password, user.hashed_password);
        if (!valide_password){
            throw new AppError ("Password is not correct", 401)
        }
        //3. get a jwt token 
        const token = jwt.sign(
            {id: user.id},
            JWT_SECRET,
            {expiresIn: '7d'}
        )
        //return data with token
        return {
            token,
            user: {id: user.id, username: user.username, email: user.email}
        }
    }
}