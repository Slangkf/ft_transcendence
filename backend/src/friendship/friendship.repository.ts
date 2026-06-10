import type { FriendshipOutput, SendFriendRequestInput } from '@shared/friendship.schema';
import { prisma } from '../lib/prisma';

export class FriendshipRepository {
    /* Creates a PENDING friendship row from userId to friendId (with both users joined). */
    async create_friend_request(userId: number, friendId: number): Promise<FriendshipOutput> {
        return await prisma.friendship.create({
            data: {
                userId,
                friendId,
                status: 'PENDING'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        url: true
                    }
                },
                friend: {
                    select: {
                        id: true,
                        username: true,
                        url: true
                    }
                }
            }
        });
    }

    /* Finds a single friendship row by its id, or null. */
    async find_by_id(friendshipId: number) {
        return await prisma.friendship.findUnique({
            where: { id: friendshipId }
        });
    }

    /* Finds the friendship between two users in either direction, or null. */
    async find_friendship_between_users(userId1: number, userId2: number) {
        return await prisma.friendship.findFirst({
            where: {
                OR: [
                    { userId: userId1, friendId: userId2 },
                    { userId: userId2, friendId: userId1 }
                ]
            }
        });
    }

    /* Updates a friendship's status (e.g. PENDING -> ACCEPTED) and returns it. */
    async update_status(friendshipId: number, status: 'PENDING' | 'ACCEPTED'): Promise<FriendshipOutput> {
        return await prisma.friendship.update({
            where: { id: friendshipId },
            data: { status },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        url: true
                    }
                },
                friend: {
                    select: {
                        id: true,
                        username: true,
                        url: true
                    }
                }
            }
        });
    }

    /* Deletes a friendship row by id (used for decline and unfriend). */
    async delete_friendship(friendshipId: number): Promise<void> {
        await prisma.friendship.delete({
            where: { id: friendshipId }
        });
    }

    /* Returns all ACCEPTED friendships involving the user (either side), with statuses. */
    async get_accepted_friendships(userId: number): Promise<FriendshipOutput[]> {
        return await prisma.friendship.findMany({
            where: {
                OR: [
                    { userId, status: 'ACCEPTED' },
                    { friendId: userId, status: 'ACCEPTED' }
                ]
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        url: true,
                        status: true,
                    }
                },
                friend: {
                    select: {
                        id: true,
                        username: true,
                        url: true,
                        status: true,
                    }
                }
            }
        });
    }

    /* Returns PENDING requests received by the user (they are the friendId). */
    async get_pending_requests(userId: number): Promise<FriendshipOutput[]> {
        return await prisma.friendship.findMany({
            where: {
                friendId: userId,
                status: 'PENDING'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        url: true
                    }
                },
                friend: {
                    select: {
                        id: true,
                        username: true,
                        url: true
                    }
                }
            }
        });
    }

    /* Returns PENDING requests sent by the user (they are the userId). */
    async get_sent_requests(userId: number): Promise<FriendshipOutput[]> {
        return await prisma.friendship.findMany({
            where: {
                userId,
                status: 'PENDING'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        url: true
                    }
                },
                friend: {
                    select: {
                        id: true,
                        username: true,
                        url: true
                    }
                }
            }
        });
    }
}