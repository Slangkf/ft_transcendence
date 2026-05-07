import { Namespace, Socket } from "socket.io";
import { FriendEmitter } from "./socket.emitter";
import { Redis, RedisKeys } from "src/lib/redis";
import { FriendshipService } from "src/friendship/friendship.service";
import { UserRepository } from "src/User/user.repository";

export class FriendSocketHandler{
    constructor(
        private ns: Namespace,
        private redis: typeof Redis,
        private emitter: FriendEmitter,
        private friendshipservice: FriendshipService,
        private userRepository: UserRepository,
    ){}

    async onConnection(socket: Socket): Promise<void>{
        const userId = socket.data.userId;

        await this.redis.set(RedisKeys.socket.friendUser(userId), socket.id);

        //tell friends user is online 
        await this.notification_friendship(userId, 'friend_online');

        socket.on('disconnect', async() => {
            await this.redis.del(RedisKeys.socket.friendUser(userId));
            await this.notification_friendship(userId, 'friend_offline');
            await this.friendshipservice.update_online_status(Number(userId), 'OFFLINE');
        })
    }

    private async notification_friendship(userId: string, event: 'friend_online' | 'friend_offline'): Promise<void>{
        const friends = await this.friendshipservice.get_friends(Number(userId));
        const user = await this.userRepository.find_by_id(Number(userId));
        const nickname = user?.username || '';

        for(const F of friends){
            const friendId = String(F.userId === userId? F.friendId: F.userId);
            await this.emitter.toUser(friendId, event, {userId, nickname});
        }
    } 

}