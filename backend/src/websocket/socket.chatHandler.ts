import { Namespace, Socket } from "socket.io";
import { ChatSocketEvents } from "./socket.types";
import { ChatService } from "../chat/chat.service";
import { AppError } from "../error/apperror";
import { Redis, RedisKeys } from "../lib/redis";


type chatNamespace = Namespace<Record<string, never>, ChatSocketEvents>;
type chatSocket = Socket<Record<string, never>, ChatSocketEvents>;

/**
 * @class ChatSocketHandler
 * @description Statefully manages direct, instant message delivery, message histories, 
 * unread badges, and presence logic for real-time messaging using Socket.io and Redis caches.
 */
export class ChatSocketHandler{
    // Memory cache mapping temporary disconnect timers per user to handle rapid reconnection
    private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
    constructor(
        private ns: chatNamespace,
        private chatservice: ChatService,
		private redis: typeof Redis
    ){}

    /**
     * @method onConnection
     * @description Executed immediately upon client socket connection.
     * Maps the socket architecture, joins private broadcast rooms, updates status in Redis, 
     * and fetches unread badge arrays for user synchronization.
     */
    async   onConnection(socket: chatSocket): Promise<void>{
        const userId = socket.data.userId;

		// CRITICAL DESIGN PATTERN: Register all event listeners synchronously *before* performing 
        // any async I/O. If an async operation yields the event loop, messages sent immediately 
        // by the client could be lost if listeners are not attached yet.
		socket.on('get_history', (data)=> this.onGetHistory(socket, userId, data));
		socket.on('send_message', (data)=> this.onSendMessage(socket, userId, data));
        socket.on('mark_read', (data)=> this.onMarkRead(socket, userId, data));
        socket.on('disconnect', ()=> this.onDisconnect(socket, userId));

        // Map the online User ID to this specific Socket ID in Redis
		await this.redis.set(RedisKeys.socket.chatUser(userId), socket.id);

        // Join a dedicated personal room (`user:${userId}`). This allows system-wide services 
        // or other namespaces to route targeted messages directly to this user's socket.
		socket.join(`user:${userId}`);

        // Fetch unread count telemetry instantly upon landing so badge indicators render accurately
        const unread = await this.chatservice.getUnreadCountPerSender(Number(userId));
        socket.emit('unread_count', {perSender: unread});
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

            const unread = await this.chatservice.getUnreadCountPerSender(Number(userId));
            socket.emit('unread_count', {perSender: unread});
        }catch (error){
            socket.emit('error', {
                message: "failed to mark read in socket"
            })
        }
    }

    /**
     * @method onDisconnect
     * @description Fired on connection drop. Removes instant routing keys from Redis.
     * Provisions a standard 2-second debouncing window to absorb transient connection 
     * losses without prematurely modifying background persistence records.
     */
    private async onDisconnect(socket: chatSocket, userId: string): Promise<void>{
        // Wipe primary active connection index instantly
        await this.redis.del(RedisKeys.socket.chatUser(userId));
        // Track the disconnect event in Redis with a 30-second TTL as a secondary indicator
        await this.redis.set(RedisKeys.socket.chatDisconnect(userId), '1', {EX: 30})

        const timer = setTimeout(async () => {
			this.disconnectTimers.delete(userId);

            // If another instance of chatUser was saved during this 2000ms window, 
            // the user successfully reconnected. Abort deletion routines.
            const stillDisconnected = await this.redis.get(RedisKeys.socket.chatUser(userId));
            if (!stillDisconnected) return;

            // Clear transient tracking key when disconnect is confirmed permanent
            await this.redis.del(RedisKeys.socket.chatDisconnect(userId));
        }, 2_000);
        this.disconnectTimers.set(userId, timer);
    }
}
