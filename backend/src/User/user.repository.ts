import type { UserDB, RegisterInput, UserOutput, UserProfil} from "@shared/user.schema";
import {prisma} from '../lib/prisma';
import bcrypt from 'bcrypt';
import { AppError } from "src/error/apperror";

export class UserRepository{
    //1. creation a compte
    async create(input: RegisterInput): Promise<UserOutput>{
        const hashed_password = await bcrypt.hash(input.password, 10);
        const newuser = await prisma.user.create({
            data:{
                username: input.username,
                email: input.email,
                password: hashed_password,
            }
        })
        return {
            id: newuser.id,
            username: newuser.username,
            email: newuser.email
        }
    }

    //find a user by email or username, prepare for authendification 
    async find_by_identifiant(identifiant: string): Promise<UserDB|null>{
        const user = await prisma.user.findUnique({
            where: {email: identifiant}
        })
        if (!user)  return null 
        return user
    }

    async findByUsername(identifiant: string): Promise<UserDB|null>{
        const user = await prisma.user.findUnique({
            where: {username: identifiant}
        })
        if (!user)  return null 
        return user
    }

    async find_by_id(userid: number): Promise<UserDB | null>{
        const user = await prisma.user.findUnique({
            where: {id: userid}
        })
        if (!user) return null
        return user
    }

    //update password 
    async update_password(userid: number, new_pd: string){
        return await prisma.user.update({
            where: {id: userid},
            data: {
                password: new_pd
            }
        })
    }
}


/**
 *  UserRepository:
 *      1. create a user, createdAt and id will get automatique
 *      2.
 *      3. update password （only update, level service do the check)
 *      4. find a user by email
 *      5. find a user by id(use for get profil of a user)
 *      6. 
 * 
 * 
 */