import { Namespace, Socket } from "socket.io";
import { FriendEmitter } from "./socket.emitter";
import { FriendSocketEvents } from "./socket.types";
import { Redis, RedisKeys } from "../lib/redis";
import { FriendshipService } from "../friendship/friendship.service";
import { UserRepository } from "../User/user.repository";

type friendNamespace = Namespace<{}, FriendSocketEvents>;
type friendSocket = Socket<{}, FriendSocketEvents>;

/**
 * @class FriendSocketHandler
 * @description Manages real-time social/friendship state events over WebSockets. 
 * Handles user presence (online/offline notifications) with a short connection-loss 
 * grace period to prevent notification "flickering" due to sudden network blips.
 */
export class FriendSocketHandler{
    // Local memory cache tracking temporary disconnect timers per user
    private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
    constructor(
        private ns: friendNamespace,
        private redis: typeof Redis,
        private emitter: FriendEmitter,
        private friendshipservice: FriendshipService,
        private userRepository: UserRepository,
    ){}

    /*
     * Handles a new friendship-socket connection: binds the disconnect listener,
     * maps the user to this socket in Redis, and broadcasts 'online' to friends —
     * unless it's a quick reconnect within the grace window (then stays silent).
     */
    async onConnection(socket: friendSocket): Promise<void>{
        const userId = socket.data.userId;

        // Bind the disconnect event listener immediately on connection
		socket.on('disconnect', () => this.onDisconnect(userId, socket.data.nickname));

        // Check if this connection is a quick recovery from a temporary network drop
        const existTimer = this.disconnectTimers.get(userId);
        if (existTimer){
            clearTimeout(existTimer);
            this.disconnectTimers.delete(userId);
            
            // Map the fresh socket ID back to the user in Redis and skip sending 
            // another online notification (since they never truly stayed offline)
            await this.redis.set(RedisKeys.socket.friendUser(userId), socket.id);
            return;
        }
        // Brand new connection: Map user to socket ID and broadcast status
        await this.redis.set(RedisKeys.socket.friendUser(userId), socket.id);

        //tell friends user is online 
        await this.notification_friendship(userId, socket.data.nickname);
    }

    /**
     * @method notification_friendship
     * @description Dispatches a real-time 'friend_online' event payload 
     * to all active friends associated with the targeted user ID.
     */
    private async notification_friendship(userId: string, nickname: string): Promise<void>{
        try{
            // Retrieve full relational friendship array from database/cache
            const friends = await this.friendshipservice.get_friends(Number(userId));

            // Map and concurrently emit events targeting individual friend socket channels
            await Promise.all(
                friends.map(friend => {
                    // Extract the other person's ID from the bidirectional friendship record
                    const friendId = (friend.userId === Number(userId)) ? friend.friendId : friend.userId;
                    this.emitter.toUser(String(friendId), 'friend_online', {
                        userId,
                        nickname,
                    })
                })
            )
        }catch(error){
            console.error("error in notify friend: ", error);
        }
    } 

    /**
     * @method onDisconnect
     * @description Handles connection drop logs. Instantly tears down the active Redis mapping.
     * Deploys a 2-second debouncing window before executing the heavy friend-wide notification matrix
     * to verify the client isn't just performing a rapid page refresh.
     */
    private async onDisconnect(userId: string, nickname: string): Promise<void>{
        // Immediately remove active socket mapping so other systems don't route data to a dead pipe
        await this.redis.del(RedisKeys.socket.friendUser(userId));

        // Start a 2-second grace interval to debounce flickering online/offline statuses
        const timer = setTimeout(async ()=> {
			this.disconnectTimers.delete(userId);
            const stillDisconnected = !(await this.redis.get(RedisKeys.socket.friendUser(userId)));
            if (!stillDisconnected) return ;

            try{
                // Retrieve friends list and emit offline presence notification
                const friends = await this.friendshipservice.get_friends(Number(userId));
                await Promise.all(
                    friends.map(friend => {
                        const friendId = (friend.userId === Number(userId)) ? friend.friendId : friend.userId;
                        this.emitter.toUser(String(friendId), 'friend_offline', {
                            userId,
                            nickname,
                        })
                    })
                )
            } catch(error){
                console.error('error notify friends offline: ', error);
            }
        }, 2_000)
        this.disconnectTimers.set(userId, timer);  
    }
}
