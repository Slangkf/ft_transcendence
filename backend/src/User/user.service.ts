import { UserRepository } from './user.repository'
import type {UserOutput, ChangePdInput, ChangeUsernameInput} from '@shared/user.schema'
import { AppError, ErrorCode } from 'src/error/apperror';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';

export class UserService{
    constructor(private userrepository: UserRepository)
    {}

    async get_profile(input: number): Promise<UserOutput>{
        const user = await this.userrepository.find_by_id(input);
        if (!user){
			throw new AppError(
				'Unknown user', 
				ErrorCode.USER_NOT_FOUND,
				401,
				{user: input});
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
            throw new AppError(
				'Unknown user', 
				ErrorCode.USER_NOT_FOUND,
				404,
				{userID: userid});

        }

        const is_valide = await bcrypt.compare(input.oldpassword, user.password);
        if (!is_valide){
			throw new AppError(
				'Incorrect old password', 
				ErrorCode.INVALID_OLD_PASSWORD,
				401,
				{oldpassword: input.oldpassword});
        }

        if (input.oldpassword === input.newpassword){
			throw new AppError(
				'The new password cannot be the same as the old one', 
				ErrorCode.SAME_NEW_OLD_PASSWORD,
				400,
				{newpassword: input.newpassword});
        }

        const new_hashed_pd = await bcrypt.hash(input.newpassword, 10);
        await this.userrepository.update_password(userid, new_hashed_pd);
     
        return true;
    }

    async change_username(userid: number, input: ChangeUsernameInput): Promise<UserOutput> {
        const user = await this.userrepository.find_by_id(userid);
        if (!user) {
			throw new AppError(
				'Unknown user', 
				ErrorCode.USER_NOT_FOUND,
				404,
				{userID: userid});
		
        }

        if (user.username === input.newUsername) {
			throw new AppError(
				'The new username cannot be the same as the old one', 
				ErrorCode.SAME_NEW_OLD_USERNAME,
				400,
				{newusername: input.newUsername});
        }

        const existingUser = await this.userrepository.find_by_username(input.newUsername);
        if (existingUser) {
			throw new AppError(
				'Username already taken', 
				ErrorCode.AUTH_USERNAME_ALREADY_EXIST,
				409,
				{newusername: input.newUsername});
        }

        await this.userrepository.update_username(userid, input.newUsername);
        return await this.get_profile(userid);
    }

    async update_avatar(userid: number, file?: Express.Multer.File): Promise<UserOutput>{
        if (!file) {
            throw new AppError(
                'Need an avatar file',
                ErrorCode.AVATAR_REQUIRED,
                400);
        }

        const user = await this.userrepository.find_by_id(userid);
        if (!user){
			throw new AppError(
				'Unknown user', 
				ErrorCode.USER_NOT_FOUND,
				404,
				{userID: userid});
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
