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


    async sendPrivateMessage(fromId: number, toUserId: number, content: string): Promise<ChatMessageDTO>{
        
        //check if they are friends 
        const areFriends = await this.friendservice.areFriends(fromId, toUserId);
        if (!areFriends){
            throw new AppError('Not friends', ErrorCode.FRIEND_NOT_FOUND, 403);
        }

        //save the message in database
        const message = await this.chatrepo.saveMessage(fromId, toUserId, content);

        const chatMessage = {
            messageId: String(message.id),
            fromUserId: String(fromId),
            toUserId: String(toUserId),
            content,
            createdAt: message.createdAt,
        } as const;

        const socketPayload = {
            ...chatMessage,
            createdAt: message.createdAt.getTime(),
        };
        await this.emitter.toUser(String(toUserId), 'message_received', socketPayload);

        return chatMessage;
    }

    async getHistory(userId: number, withUserId: number, limit= 50, before?: Date){
        const areFriends = await this.friendservice.areFriends(userId, withUserId);
        if (!areFriends){
            throw new AppError('Not friends', ErrorCode.FRIEND_NOT_FOUND, 403);
        }
        return this.chatrepo.getHistory(userId, withUserId, limit, before);
    }

    async markAsRead(userId: number, fromUserId: number){
        return await this.chatrepo.markAsRead(fromUserId, userId);
    }

    async getUnreadCount(userId: number) {
        return this.chatrepo.getUnreadCount(userId);
    }
}






/**
 * chat service 
 * 
 * 
 */