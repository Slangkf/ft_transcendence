import { FriendshipRepository } from './friendship.repository';
import { UserRepository } from '../User/user.repository';
import type { FriendshipOutput, SendFriendRequestInput } from '@shared/friendship.schema';
import { FriendEmitter, ChatEmitter } from '../websocket/socket.emitter';
import { ChatRepository } from '../chat/chat.repository';
import { AppError, ErrorCode } from '../error/apperror';

export class FriendshipService {
    

    constructor(
        private friendshipRepository: FriendshipRepository,
        private userRepository: UserRepository,
        private emitter: FriendEmitter,
        private chatEmitter: ChatEmitter,
        private chatRepository: ChatRepository,
    ) {}

    async send_friend_request(userId: number, input: SendFriendRequestInput): Promise<FriendshipOutput> {
        if (userId === input.friendId) {
            throw new AppError("Cannot send friend request to yourself", ErrorCode.FRIEND_SELF_REQUEST, 400);
        }

        const user = await this.userRepository.find_by_id(userId);
        const friend = await this.userRepository.find_by_id(input.friendId);

        if (!user || !friend) {
            throw new AppError("User not found", ErrorCode.USER_NOT_FOUND, 404);
        }

        const existingFriendship = await this.friendshipRepository.find_friendship_between_users(userId, input.friendId);
        if (existingFriendship) {
            if (existingFriendship.status === 'ACCEPTED') {
                throw new AppError("Already friends", ErrorCode.FRIEND_ALREADY_EXISTS, 400);
            } else if (existingFriendship.status === 'PENDING') {
                throw new AppError("Friend request already sent", ErrorCode.FRIEND_REQUEST_PENDING, 400);
            }
        }

        const result = await this.friendshipRepository.create_friend_request(userId, input.friendId);
        //notification for friend
        await this.emitter.toUser(String(input.friendId), 'friend_request', {
            fromUserId: String(userId),
            fromNickname: user.username,
        })

        return result;
    }

    async accept_friend_request(userId: number, friendshipId: number): Promise<FriendshipOutput> {
        const friendship = await this.friendshipRepository.find_by_id(friendshipId);

        if (!friendship) {
            throw new AppError("Friend request not found", ErrorCode.FRIEND_REQUEST_NOT_FOUND, 404);
        }

        if (friendship.friendId !== userId) {
            throw new AppError("Unauthorized to accept this friend request", ErrorCode.FORBIDDEN, 403);
        }

        if (friendship.status !== 'PENDING') {
            throw new AppError("Friend request is not pending", ErrorCode.BAD_REQUEST, 400);
        }

        const updatedFriendship = await this.friendshipRepository.update_status(friendshipId, 'ACCEPTED');

        await this.userRepository.increment_friends_count(friendship.userId);
        await this.userRepository.increment_friends_count(friendship.friendId);

        //socket notification 
        await this.emitter.toUser(String(friendship.userId), 'friend_accept', {
            userId: String(userId),
            nickname: (await this.userRepository.find_by_id(userId))?.username ?? ''
        })
        return updatedFriendship;
    }

    async decline_friend_request(userId: number, friendshipId: number): Promise<void> {
        const friendship = await this.friendshipRepository.find_by_id(friendshipId);

        if (!friendship) {
            throw new AppError("Friend request not found", ErrorCode.FRIEND_REQUEST_NOT_FOUND, 404);
        }

        if (friendship.friendId !== userId) {
            throw new AppError("Unauthorized to decline this friend request", ErrorCode.FORBIDDEN, 403);
        }

        if (friendship.status !== 'PENDING') {
            throw new AppError("Friend request is not pending", ErrorCode.BAD_REQUEST, 400);
        }

        await this.friendshipRepository.delete_friendship(friendshipId);
    }

    async remove_friend(userId: number, friendId: number): Promise<void> {
        const friendship = await this.friendshipRepository.find_friendship_between_users(userId, friendId);

        if (!friendship) {
            throw new AppError("Friendship not found", ErrorCode.FRIEND_NOT_FOUND, 404);
        }

        if (friendship.userId !== userId && friendship.friendId !== userId) {
            throw new AppError("Unauthorized to remove this friendship", ErrorCode.FORBIDDEN, 403);
        }

        if (friendship.status !== 'ACCEPTED') {
            throw new AppError("Cannot remove non-accepted friendship", ErrorCode.FRIEND_NOT_ACCEPTED, 400);
        }

        const nickname = (await this.userRepository.find_by_id(userId))?.username ?? '';

        await this.chatRepository.markAsRead(userId, friendId);
        await this.chatRepository.markAsRead(friendId, userId);

        await this.emitter.toUser(String(friendId), 'friend_remove', {
            userId: String(userId),
            nickname,
        });

        await this.friendshipRepository.delete_friendship(friendship.id);

        await this.userRepository.decrement_friends_count(friendship.userId);
        await this.userRepository.decrement_friends_count(friendship.friendId);

        const removerUnread = await this.chatRepository.getUnreadCountPerSender(userId);
        const removedUnread = await this.chatRepository.getUnreadCountPerSender(friendId);

        await this.chatEmitter.toUser(String(userId), 'unread_count', { perSender: removerUnread });
        await this.chatEmitter.toUser(String(friendId), 'unread_count', { perSender: removedUnread });
    }

    async get_friends(userId: number): Promise<FriendshipOutput[]> {
        return await this.friendshipRepository.get_accepted_friendships(userId);
    }

	async get_friends_for_friend(username: string): Promise<FriendshipOutput[]> {
        const user = await this.userRepository.findByUsername(username); 
        if (!user) {
            throw new AppError("User not found", ErrorCode.USER_NOT_FOUND, 404);
        }
        return await this.friendshipRepository.get_accepted_friendships(user.id);
    }

    async get_pending_requests(userId: number): Promise<FriendshipOutput[]> {
        return await this.friendshipRepository.get_pending_requests(userId);
    }

    async get_sent_requests(userId: number): Promise<FriendshipOutput[]> {
        return await this.friendshipRepository.get_sent_requests(userId);
    }

    async update_online_status(userId: number, status: 'ONLINE' | 'OFFLINE'): Promise<void> {
        await this.userRepository.update_status(userId, status);
    }

    async get_user_status(userId: number): Promise<{ status: string }> {
        const user = await this.userRepository.find_by_id(userId);
        if (!user) {
            throw new AppError("User not found", ErrorCode.USER_NOT_FOUND, 404);
        }
        return {
            status: user.status || 'OFFLINE'
        };
    }

    //check if one user is friend with another user
    async areFriends(fromId: number, toUserId: number): Promise<boolean> {
        const friendship = await this.friendshipRepository.find_friendship_between_users(fromId, toUserId);
        return friendship?.status === 'ACCEPTED';
    }
}