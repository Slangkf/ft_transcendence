import { AppError, ErrorCode } from "../error/apperror";
import { FriendshipService } from "../friendship/friendship.service";
import { ChatEmitter } from "../websocket/socket.emitter";
import { ChatRepository } from "./chat.repository";
import { ChatMessageDTO } from "@shared/chat.schema";

export class ChatService{
    constructor(
        private emitter: ChatEmitter,
        private friendservice: FriendshipService,
        private chatrepo: ChatRepository,
    ){}


    async sendPrivateMessage(fromId: number, receiverId: number, content: string): Promise<ChatMessageDTO>{
        
        //check if they are friends 
        const areFriends = await this.friendservice.areFriends(fromId, receiverId);
        if (!areFriends){
            throw new AppError('Not friends', ErrorCode.FRIEND_NOT_FOUND, 403);
        }

        //save the message in database
        const message = await this.chatrepo.saveMessage(fromId, receiverId, content);

        const chatMessage = {
            messageId: String(message.id),
            senderId: String(fromId),
            receiverId: String(receiverId),
            content,
            createdAt: message.createdAt,
        } as const;

        const socketPayload = {
            ...chatMessage,
            createdAt: message.createdAt.getTime(),
        };
        await this.emitter.toUser(String(receiverId), 'message_received', socketPayload);
        const unread = await this.getUnreadCountPerSender(receiverId);
        await this.emitter.toUser(String(receiverId), 'unread_count', {perSender: unread});

        return chatMessage;
    }

    async getHistory(userId: number, withUserId: number, limit= 50, before?: Date){
        const areFriends = await this.friendservice.areFriends(userId, withUserId);
        if (!areFriends){
            throw new AppError('Not friends', ErrorCode.FRIEND_NOT_FOUND, 403);
        }
        return this.chatrepo.getHistory(userId, withUserId, limit, before);
    }

    async markAsRead(userId: number, senderId: number){
        return await this.chatrepo.markAsRead(senderId, userId);
    }

    async getUnreadCountPerSender(userId: number): Promise<{ senderId: number; count: number }[]> {
        return this.chatrepo.getUnreadCountPerSender(userId);
    }
}






/**
 * chat service 
 * 
 * 
 */