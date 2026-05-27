import { Namespace, Socket } from "socket.io";
import { FriendEmitter } from "./socket.emitter";
import { FriendSocketEvents } from "./socket.types";
import { Redis, RedisKeys } from "../lib/redis";
import { FriendshipService } from "../friendship/friendship.service";
import { UserRepository } from "../User/user.repository";

type friendNamespace = Namespace<{}, FriendSocketEvents>;
type friendSocket = Socket<{}, FriendSocketEvents>;

export class FriendSocketHandler{
    private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
    constructor(
        private ns: friendNamespace,
        private redis: typeof Redis,
        private emitter: FriendEmitter,
        private friendshipservice: FriendshipService,
        private userRepository: UserRepository,
    ){}

    async onConnection(socket: friendSocket): Promise<void>{
        const userId = socket.data.userId;

		socket.on('disconnect', () => this.onDisconnect(userId, socket.data.nickname));

        const existTimer = this.disconnectTimers.get(userId);
        if (existTimer){
            clearTimeout(existTimer);
            this.disconnectTimers.delete(userId);
            
            await this.redis.set(RedisKeys.socket.friendUser(userId), socket.id);
            return;
        }
        await this.redis.set(RedisKeys.socket.friendUser(userId), socket.id);

        //tell friends user is online 
        await this.notification_friendship(userId, socket.data.nickname);
    }

    private async notification_friendship(userId: string, nickname: string): Promise<void>{
        try{
            const friends = await this.friendshipservice.get_friends(Number(userId));
            await Promise.all(
                friends.map(friend => {
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

    private async onDisconnect(userId: string, nickname: string): Promise<void>{
        await this.redis.del(RedisKeys.socket.friendUser(userId));

        const timer = setTimeout(async ()=> {
			this.disconnectTimers.delete(userId);
            const stillDisconnected = !(await this.redis.get(RedisKeys.socket.friendUser(userId)));
            if (!stillDisconnected) return ;

            try{
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
        }, 15_000)
        this.disconnectTimers.set(userId, timer);  
    }
}
