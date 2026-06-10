import { AppError, ErrorCode } from "../error/apperror";
import { FriendshipService } from "../friendship/friendship.service";
import { ChatEmitter } from "../websocket/socket.emitter";
import { ChatRepository } from "./chat.repository";
import { ChatMessageDTO } from "@shared/chat.schema";

/**
 * @class ChatService
 * @description to send private messages service
 * -validate friendship permissions
 * -send private messages
 * -retrieve conversation history
 * -manager read/unread status
 * -delivre a real-time chat notifications
 * 
 */
export class ChatService{
    constructor(
        private emitter: ChatEmitter,
        private friendservice: FriendshipService,
        private chatrepo: ChatRepository,
    ){}


    /**
     * @method sendPrivateMessage
     * @description send a private message between two friends
     * -verify friendshi relationship
     * -persiste the message
     * -delivre real-time notification
     * -update unread message counters
     * @param fromId 
     * @param receiverId 
     * @param content 
     * @returns 
     */
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

    /*
     * Returns the conversation history between two users (most recent first).
     * Requires them to be friends, otherwise throws 403.
     */
    async getHistory(userId: number, withUserId: number, limit= 50, before?: Date){
        const areFriends = await this.friendservice.areFriends(userId, withUserId);
        if (!areFriends){
            throw new AppError('Not friends', ErrorCode.FRIEND_NOT_FOUND, 403);
        }
        return this.chatrepo.getHistory(userId, withUserId, limit, before);
    }

    /* Marks every message from senderId to userId as read. */
    async markAsRead(userId: number, senderId: number){
        return await this.chatrepo.markAsRead(senderId, userId);
    }

    /* Returns the number of unread messages grouped by sender for a user. */
    async getUnreadCountPerSender(userId: number): Promise<{ senderId: number; count: number }[]> {
        return this.chatrepo.getUnreadCountPerSender(userId);
    }
}






/**
 * chat service 
 * 
 * 
 */