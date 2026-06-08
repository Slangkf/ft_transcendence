import { FriendshipRepository } from './friendship.repository';
import { UserRepository } from '../User/user.repository';
import type { FriendshipOutput, SendFriendRequestInput } from '@shared/friendship.schema';
import { FriendEmitter, ChatEmitter } from '../websocket/socket.emitter';
import { ChatRepository } from '../chat/chat.repository';
import { AppError, ErrorCode } from '../error/apperror';

/**
 * @class FriendshipService
 * @description manage friendship relationships
 * - send friend requests
 * - accept friend requests
 * - decline frien requests
 * - remove friendships
 * - retrieve friends and requests
 * - track online status
 * - validate friendship permissions
 * - trigger friendship notifications
 */
export class FriendshipService {
    

    constructor(
        private friendshipRepository: FriendshipRepository,
        private userRepository: UserRepository,
        private emitter: FriendEmitter,
        private chatEmitter: ChatEmitter,
        private chatRepository: ChatRepository,
    ) {}

    /**
     * @method send_friend_request
     * @description send a friend request to another user
     * rules: 
     * - cannot to send to yourself
     * - both users must exist
     * - users cannot already friends
     * - duplicate pending requests are not allowed 
     * @param userId 
     * @param input 
     * @returns created friendship request 
     */
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

    /**
     * @method accept_friend_request
     * @description accepte a pending friend request
     * - verify request exists
     * - verify overship
     * - verify pending status
     * - mark request as accepted
     * - update friend counters
     * - notify the requester 
     * @param userId 
     * @param friendshipId 
     * @returns Updated friendship
     */
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

    /**
     * @method decline_friend_request
     * @description deckube a pending friend request
     * only the request recipient may decline the invitation
     * @param userId 
     * @param friendshipId 
     */
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

    /**
     * @method remove_friend
     * @description remove an existing friendship
     * verify friendship exists, verify requester is a participant, verify friendship is accepted, 
     * clear unread message state, notify the removed friend, delete friendship, update friend counters,
     * refresh unread counts
     * @param userId 
     * @param friendId 
     */
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