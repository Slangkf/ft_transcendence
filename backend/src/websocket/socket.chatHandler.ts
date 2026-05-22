import { Namespace, Socket } from "socket.io";
import { ChatSocketEvents } from "./socket.types";
import { ChatService } from "../chat/chat.service";
import { AppError } from "../error/apperror";
import { Redis, RedisKeys } from "../lib/redis";


type chatNamespace = Namespace<Record<string, never>, ChatSocketEvents>;
type chatSocket = Socket<Record<string, never>, ChatSocketEvents>;

export class ChatSocketHandler{
    constructor(
        private ns: chatNamespace,
        private chatservice: ChatService,
		private redis: typeof Redis
    ){}

    async   onConnection(socket: chatSocket): Promise<void>{
        const userId = socket.data.userId;

		// Register all handlers before async operation to avoid missing events
		socket.on('get_history', (data)=> this.onGetHistory(socket, userId, data));
		socket.on('send_message', (data)=> this.onSendMessage(socket, userId, data));
        socket.on('mark_read', (data)=> this.onMarkRead(socket, userId, data));
        socket.on('disconnect', ()=> socket.leave(`user:${userId}`))

		await this.redis.set(RedisKeys.socket.chatUser(userId), socket.id);
		socket.join(`user:${userId}`);
    }

    private async onSendMessage(socket: chatSocket, userId: string, data:{receiverId: string; content: string}): Promise<void>{
        try{
            const message = await this.chatservice.sendPrivateMessage(Number(userId), Number(data.receiverId), data.content);
            //wait toUser receive
            socket.emit('message_send', {
                messageId: message.messageId,
                receiverId: data.receiverId,
                content: data.content,
                createdAt: message.createdAt.getTime(),
            })
        }catch(error){
            socket.emit('error', {message: error instanceof AppError? error.message : "failed to send message"})
        }
    }

    private async onGetHistory(socket: chatSocket, userId: string, data:{withUserId: string; limit?: number; before?: Date}): Promise<void>{
        try{
            const message = await this.chatservice.getHistory(Number(userId), Number(data.withUserId), data.limit, data.before);
            socket.emit('history', {withUserId: data.withUserId, message})
        }catch(error){
            socket.emit('error', {message: error instanceof AppError? error.message : "failed to getHistory socket"});
        }
    }

    private async onMarkRead(socket: chatSocket, userId: string, data: {senderId: string}): Promise<void>{
        try{
            await this.chatservice.markAsRead(Number(userId), Number(data.senderId));
        }catch (error){
            socket.emit('error', {
                message: "failed to mark read in socket"
            })
        }
    }
}