import { UserRepository } from './user.repository'
import type {UserOutput, ChangePdInput, ChangeUsernameInput} from '@shared/user.schema'
import { AppError, ErrorCode } from 'src/error/apperror';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';

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

    async change_username(userid: number, input: ChangeUsernameInput): Promise<UserOutput> {
        const user = await this.userrepository.find_by_id(userid);
        if (!user) {
            throw new AppError("user not found", 404);
        }

        if (user.username === input.newUsername) {
            throw new AppError("new username cannot be the same as current", 400);
        }

        const existingUser = await this.userrepository.find_by_username(input.newUsername);
        if (existingUser) {
            throw new AppError("username already taken", 409);
        }

        await this.userrepository.update_username(userid, input.newUsername);
        return await this.get_profile(userid);
    }

    async update_avatar(userid: number, file?: Express.Multer.File): Promise<UserOutput>{
        if (!file) {
            // throw new AppError(
            //     "avatar file is required",
            //     ErrorCode.AVATAR_REQUIRED,
            //     400);
            throw new AppError("avatar file is required", 400);
        }

        const user = await this.userrepository.find_by_id(userid);
        if (!user){
            throw new AppError("user not found", 404)
        }

        const previousAvatarUrl = user.url;
        const avatarUrl = `/uploads/avatars/${file.filename}`;
        const updatedUser = await this.userrepository.update_avatar(userid, avatarUrl);

        await this.delete_previous_avatar(previousAvatarUrl);

        return updatedUser;
    }

    private async delete_previous_avatar(avatarUrl?: string | null): Promise<void>{
        if (!avatarUrl || avatarUrl === '/uploads/avatars/default.jpg'){
            return;
        }

        if (!avatarUrl.startsWith('/uploads/avatars/')){
            return;
        }

        const avatarPath = path.resolve(process.cwd(), avatarUrl.slice(1));

        try{
            await fs.unlink(avatarPath);
        }catch(error: any){
            if (error?.code !== 'ENOENT'){
                console.log('failed to delete previous avatar:', error);
            }
        }
    }

}

/****
 * UserService: 
 *  1. get profil: element withou password(User part, friend part later)
 *  2. update profil: change password
 *  3. 
 */
