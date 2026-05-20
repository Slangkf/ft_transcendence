import type { UserDB, RegisterInput, UserOutput } from "@shared/user.schema";
import {prisma} from '../lib/prisma';
import bcrypt from 'bcrypt';

export class UserRepository{
    private toUserOutput(user: Pick<UserDB, 'id' | 'username' | 'email' | 'url' | 'createdAt' | 'score' | 'wins' | 'played' | 'friendsNb' | 'status' | 'role'>): UserOutput {
        return {
            id: user.id,
            createdAt: user.createdAt,
            username: user.username,
            email: user.email,
            url: user.url,
            score: user.score,
            wins: user.wins,
            played: user.played,
            friendsNb: user.friendsNb,
            status: user.status,
        };
    }

    //1. create a account
    async create(input: RegisterInput): Promise<UserOutput>{
        const hashed_password = await bcrypt.hash(input.password, 10);
        const newuser = await prisma.user.create({
            data:{
                username: input.username,
                email: input.email,
                password: hashed_password,
                url: "/uploads/avatars/default.jpg",
				status: 'ONLINE',
            }
        })
        return this.toUserOutput(newuser);
    }

    //find a user by email or username, prepare for authendification 
    async find_by_email(identifiant: string): Promise<UserDB|null>{
        const user = await prisma.user.findUnique({
            where: {email: identifiant}
        })
        if (!user)  return null 
        return user
    }
    
    async find_by_username(identifiant: string): Promise<UserDB|null>{
        const user = await prisma.user.findUnique({
            where: {username: identifiant}
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

    async update_password(userid: number, new_pd: string){
        return await prisma.user.update({
            where: {id: userid},
            data: {
                password: new_pd
            }
        })
    }

    async update_username(userid: number, new_username: string){
        return await prisma.user.update({
            where: {id: userid},
            data: {
                username: new_username
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

    async increment_friends_count(userId: number): Promise<void> {
        await prisma.user.update({
            where: { id: userId },
            data: {
                friendsNb: {
                    increment: 1
                }
            }
        });
    }

    async decrement_friends_count(userId: number): Promise<void> {
        await prisma.user.update({
            where: { id: userId },
            data: {
                friendsNb: {
                    decrement: 1
                }
            }
        });
    }

    async update_status(userId: number, status: 'ONLINE' | 'OFFLINE'): Promise<void> {
        await prisma.user.update({
            where: { id: userId },
            data: {
                status
            }
        });
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
