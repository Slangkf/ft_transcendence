import type { UserDB, RegisterInput, UserOutput } from "@shared/user.schema";
import {prisma} from '@prisma/client';
import bcrypt from 'bcrypt';

export class UserRepository{
    //1. creation a compte
    async create(input: RegisterInput): Promise<UserOutput>{
        const hashed_password = await bcrypt.hash(input.password, 10);
        const newuser = await prisma.user.create({
            data:{
                username: input.username,
                email: input.email,
                hashed_password,
            }
        })
        return {
            id: newuser.id,
            username: newuser.username,
            email: newuser.email,
            token: '', //token update by authendification 
        }
    }

    //find a user by email or username, prepare for authendification 
    async find_by_identifiant(identifiant: string): Promise<UserDB|null>{
        const user = await prisma.user.findFirst({
            where: {
                OR:[
                    {email:identifiant},
                    {username: identifiant}
                ]
            }
        })
        if (!user)  return null 
        return user
    }

    //verify the password 
    async verify_password(password: string, hashed_password: string): Promise<boolean>{
        return await bcrypt.compare(password, hashed_password)
    }

}


/**
 *  UserRepository:
 *      1. create a user, createdAt and id will get automatique
 *      2. verify password
 *      3. update password (only update in database, check verifie realise in service level)
 *      4. find a user by email or username
 *      5. 
 * 
 * 
 * 
 */