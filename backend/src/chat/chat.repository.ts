import { PrismaClient } from "@prisma/client/extension";


export class ChatRepository{
    constructor(
        private prisma: PrismaClient
    ){}

    // save a message
    async saveMessage(fromId: number, toUserId: number, content: string){
        await this.prisma.create({
            
        })
    }

    //get history 
    async getHistory(userAId: number, userBId: number, limit = 50, before?: Date){

    }

    //mark the message has read 
    async markAsRead(fromId: number, toUserId: number){

    }
    //
}