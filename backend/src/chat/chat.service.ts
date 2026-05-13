import { FriendshipRepository } from "src/friendship/friendship.repository";
import { FriendshipService } from "src/friendship/friendship.service";
import { RoomService } from "src/room/room.service";
import { ChatEmitter } from "src/websocket/socket.emitter";
import { ChatRepository } from "./chat.repository";
import { AppError, ErrorCode } from "src/error/apperror";
import { ErrorReply } from "redis";

export class ChatService{
    constructor(
        private emitter: ChatEmitter,
        private friendservice: FriendshipService,
        private chatrepo: ChatRepository,
    ){}

    async sendPrivateMessage(fromId: number, toUserId: number, content: string){
        
        //check if they are friends 
        const areFriends = await this.friendservice.areFriends(fromId, toUserId);
        if (!areFriends){
            throw new AppError('Not friends', ErrorCode.FRIEND_NOT_FOUND, 403);
        }

        //save the message in database
        const message = await this.chatrepo.saveMessage(fromId, toUserId, content);

        //tell toUserId a message received
        await this.emitter.toUser(String(toUserId), 'message_received', {
            messageId: message.id,
            fromUserId: String(fromId),
            content,
            createdAt: message.createdAt,
        });

        return message;
    }

    async getHistory(userId: number, withUserId: number, limite= 50, before?: Data){
        const areFriends = await this.friendservice.areFriends(userId, withUserId);
        if (!areFriends){
            throw new AppError('Not friends', ErrorCode.FRIEND_NOT_FOUND, 403);
        }
        return this.chatrepo.getHistory(userId, withUserId, limite, before);
    }

    async markAsRead(userId: number, fromUserId: number){
        return await this.chatrepo.markAsRead(fromUserId, userId);
    }

    
}






/**
 * chat service 
 * 
 * 
 */