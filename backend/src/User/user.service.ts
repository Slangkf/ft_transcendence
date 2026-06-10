import { UserRepository } from './user.repository'
import type {UserOutput, ChangePdInput, ChangeUsernameInput} from '@shared/user.schema'
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';
import { AppError, ErrorCode } from '../error/apperror';

/**
 * @class UserService
 * @description logic for user management profil modifications.
 * 
 */
export class UserService{
    constructor(private userrepository: UserRepository)
    {}

    /* Returns the user's public profile by id (password stripped); 404 if unknown. */
    async get_profile(input: number): Promise<UserOutput>{
        const user = await this.userrepository.find_by_id(input);
        if (!user){
			throw new AppError(
				'Unknown user', 
				ErrorCode.USER_NOT_FOUND,
				404,
				{user: input});
        }
        const {password, ...profil_of_user} = user;
        return profil_of_user
    }

    /* Returns the user's public profile by username (password stripped); 404 if unknown. */
    async get_profile_by_username(username: string): Promise<UserOutput>{
        const user = await this.userrepository.find_by_username(username);
        if (!user){
			throw new AppError(
				'Unknown user', 
				ErrorCode.USER_NOT_FOUND,
				404,
				{user: username});
        }
        const {password, ...profil_of_user} = user;
        return profil_of_user
    }

    /*
     * Changes a user's password.
     * - 404 if unknown, 401 if the old password is wrong.
     * - 400 if the new password equals the old one.
     * - Otherwise hashes and persists the new password.
     */
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

    /*
     * Changes a user's username.
     * - 404 if unknown, 400 if identical to the current one, 409 if already taken.
     * - Persists the new username and returns the refreshed profile.
     */
    async change_username(userid: number, input: ChangeUsernameInput): Promise<UserOutput> {
        const user = await this.userrepository.find_by_id(userid);
        if (!user) {
			throw new AppError(
				'Unknown user', 
				ErrorCode.USER_NOT_FOUND,
				404,
				{userID: userid});
        }

        if (user.username === input.username) {
			throw new AppError(
				'The new username cannot be the same as the old one', 
				ErrorCode.SAME_NEW_OLD_USERNAME,
				400,
				{newusername: input.username});
        }

        const existingUser = await this.userrepository.find_by_username(input.username);
        if (existingUser) {
			throw new AppError(
				'Username already taken', 
				ErrorCode.AUTH_USERNAME_ALREADY_EXIST,
				409,
				{newusername: input.username});
        }

        await this.userrepository.update_username(userid, input.username);
        return await this.get_profile(userid);
    }

    /*
     * Sets a new avatar from an uploaded file.
     * - 400 if no file, 404 if unknown user.
     * - Persists the new URL then deletes the previous file; on failure rolls
     *   back by deleting the freshly uploaded file.
     */
    async update_avatar(userid: number, file?: Express.Multer.File): Promise<UserOutput>{
        if (!file) {
            throw new AppError('avatar file is required',
                ErrorCode.AVATAR_REQUIRED,
                400,
                {userID: userid});
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
        const avatarUrl = `/avatars/${file.filename}`;

        try {
            const updatedUser = await this.userrepository.update_avatar(userid, avatarUrl);
            await this.delete_avatar_file(previousAvatarUrl);
            return updatedUser;
        } catch (error) {
            await this.delete_avatar_file(avatarUrl);
            throw error;
        }
    }

    /*
     * Best-effort deletion of an avatar file from disk.
     * - Skips the default avatar and any path outside /avatars/.
     * - Ignores a missing file (ENOENT); logs other errors without throwing.
     */
    private async delete_avatar_file(avatarUrl?: string | null): Promise<void>{
        if (!avatarUrl || avatarUrl === '/avatars/default.jpg'){
            return;
        }

        if (!avatarUrl.startsWith('/avatars/')){
            return;
        }

        const avatarPath = path.resolve(process.cwd(), avatarUrl.slice(1));

        try{
            await fs.unlink(avatarPath);
        }catch(error: any){
            if (error?.code !== 'ENOENT'){
                console.log('failed to delete avatar file:', error);
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
