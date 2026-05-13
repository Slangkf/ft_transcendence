import { Namespace, Socket } from "socket.io";
import { FriendEmitter } from "./socket.emitter";
import { Redis, RedisKeys } from "src/lib/redis";
import { FriendshipService } from "src/friendship/friendship.service";
import { UserRepository } from "src/User/user.repository";
import { FriendSocketEvents } from "./socket.types";

type friendNamespace = Namespace<FriendSocketEvents, FriendSocketEvents>;
type friendSocket = Socket<FriendSocketEvents, FriendSocketEvents>;

export class FriendSocketHandler{
    constructor(
        private ns: friendNamespace,
        private redis: typeof Redis,
        private emitter: FriendEmitter,
        private friendshipservice: FriendshipService,
        private userRepository: UserRepository,
    ){}

    async onConnection(socket: friendSocket): Promise<void>{
        const userId = socket.data.userId;

        await this.redis.set(RedisKeys.socket.friendUser(userId), socket.id);

        //tell friends user is online 
        await this.notification_friendship(userId, socket.data.nickname);

        socket.on('disconnect', () => this.onDisconnect(userId, socket.data.nickname));
    }

    private async notification_friendship(userId: string, nickname: string): Promise<void>{
        try{
            const friends = await this.friendshipservice.get_friends(Number(userId));
            console.log('friends: ', friends);
            console.log('userId: ', userId, 'nickname: ', nickname);
            await Promise.all(
                friends.map(friend => {
                    // 识别朋友的真实ID：如果当前userId是userId字段，则朋友是friendId；否则朋友是userId
                    const friendId = friend.userId === Number(userId) ? friend.friendId : friend.userId;
                    return this.emitter.toUser(String(friendId), 'friend_online', {
                        userId,
                        nickname,
                    });
                })
            )

        }catch(error){
            console.error("error in notify friend: ", error);
        }
    } 

    private async onDisconnect(userId: string, nickname: string): Promise<void>{
        await this.redis.del(RedisKeys.socket.friendUser(userId));

        try{
            const friends = await this.friendshipservice.get_friends(Number(userId));
            await Promise.all(
                friends.map(friend => {
                    // 识别朋友的真实ID：如果当前userId是userId字段，则朋友是friendId；否则朋友是userId
                    const friendId = friend.userId === Number(userId) ? friend.friendId : friend.userId;
                    return this.emitter.toUser(String(friendId), 'friend_offline', {
                        userId,
                        nickname,
                    });
                })
            )
        } catch(error){
            console.error('error notify friends offline: ', error);
        }
    }
}