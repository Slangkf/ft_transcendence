import type { UserDB, RegisterInput, UserOutput } from "@shared/user.schema";
import {prisma} from '../lib/prisma';
import bcrypt from 'bcrypt';

export class UserRepository{
    private toUserOutput(user: Pick<UserDB, 'id' | 'username' | 'email' | 'url' | 'wins' | 'losses' | 'friendsNb'>): UserOutput {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            url: user.url,
            wins: user.wins,
            losses: user.losses,
            friendsNb: user.friendsNb
        };
    }

    //1. creation a compte
    async create(input: RegisterInput): Promise<UserOutput>{
        const hashed_password = await bcrypt.hash(input.password, 10);
        const newuser = await prisma.user.create({
            data:{
                username: input.username,
                email: input.email,
                password: hashed_password,
                url: "/uploads/avatars/default.jpg"
            }
        })
        return this.toUserOutput(newuser);
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

    async update_avatar(userid: number, avatarUrl: string) {
        const updatedUser = await prisma.user.update({
            where: { id: userid },
            data: { url: avatarUrl }
        });

        return this.toUserOutput(updatedUser);
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
