import { 
    PrismaClient, 
     type Message, 
    Prisma
 } from "@prisma/client"


export class ChatRepository{
    constructor(
        private prisma: PrismaClient
    ){}

    // save a message
    async saveMessage(senderId: number, receiverId: number, content: string): Promise<Message>{
        return await this.prisma.message.create({
            data:{
                senderId: senderId,
                receiverId: receiverId,
                content,
            }
        })

    }

    //get history 
    async getHistory(userAId: number, userBId: number, limit = 50, before?: Date): Promise<Message[]>{
        return this.prisma.message.findMany({
            where: {
                OR: [
                    {senderId: userAId, receiverId: userBId},
                    {senderId: userBId, receiverId: userAId},
                ],
                ...(before && { createdAt: { lt: before } })
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
    

    //mark the message has read ， tell the front how many message has read 
    //batchpayload return count 
    async markAsRead(fromId: number, receiverId: number): Promise<Prisma.BatchPayload>{
        return this.prisma.message.updateMany({
            where: {senderId: fromId, receiverId: receiverId, read: false},
            data: {read: true}
        })
    }
    // message un read for each sender
    async getUnreadCountPerSender(userId: number): Promise<{senderId: number; count: number}[]> {
        const result = await this.prisma.message.groupBy({
            by: ['senderId'],
            where: { receiverId: userId, read: false },
            _count: { id: true }
        });
        return result.map(r => ({
            senderId: r.senderId,
            count: r._count.id
        }));
    }
}