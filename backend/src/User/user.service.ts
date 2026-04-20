import { UserRepository } from './user.repository'
import type {UserOutput, ChangePdInput, AuthResult} from '@shared/user.schema'
import { AppError } from 'src/error/apperror';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export class UserService{
    private userrepository: UserRepository;
    constructor(){
        this.userrepository = new UserRepository();
    }

    async get_profile(input: number): Promise<UserOutput>{
        const user = await this.userrepository.find_by_id(input);
        if (!user){
            throw new AppError("user not exist", 401)
        }
        const {password, ...profil_of_user} = user;
        return profil_of_user
    }

    async change_password(userid: number, input: ChangePdInput): Promise<Boolean>{
        // verifie with the password will realise by middleware in level controller
        // 1. verifie if the old password from input is the same in database
        // 2. change password, hash 
        // 3. update in database, and get a new token 

        const user = await this.userrepository.find_by_id(userid);
        if (!user){
            throw new AppError("user not found", 404)
        }

        const is_valide = await bcrypt.compare(input.oldpassword, user.password);
        if (!is_valide){
            throw new AppError("old password is not correct", 401);
        }

        if (input.oldpassword === input.newpassword){
            throw new AppError("new password cannot be the same as the old password", 400);
        }

        const new_hashed_pd = await bcrypt.hash(input.newpassword, 10);
        await this.userrepository.update_password(userid, new_hashed_pd);
     
        return true;
    }
}

/****
 * UserService: 
 *  1. get profil: element withou password(User part, friend part later)
 *  2. update profil: change password
 *  3. 
 */