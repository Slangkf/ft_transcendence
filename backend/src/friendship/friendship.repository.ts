import type { FriendshipOutput, SendFriendRequestInput } from '@shared/friendship.schema';
import { prisma } from '../lib/prisma';

export class FriendshipRepository {
    // Créer une demande d'ami
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

    // Trouver une amitié par ID
    async find_by_id(friendshipId: number) {
        return await prisma.friendship.findUnique({
            where: { id: friendshipId }
        });
    }

    // Trouver l'amitié entre deux utilisateurs
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

    // Mettre à jour le statut d'une amitié
    async update_status(friendshipId: number, status: 'PENDING' | 'ACCEPTED' | 'BLOCKED'): Promise<FriendshipOutput> {
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

    // Supprimer une amitié
    async delete_friendship(friendshipId: number): Promise<void> {
        await prisma.friendship.delete({
            where: { id: friendshipId }
        });
    }

    // Obtenir les amitiés acceptées d'un utilisateur
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
                        lastSeen: true
                    }
                },
                friend: {
                    select: {
                        id: true,
                        username: true,
                        url: true,
                        status: true,
                        lastSeen: true
                    }
                }
            }
        });
    }

    // Obtenir les demandes reçues en attente
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

    // Obtenir les demandes envoyées en attente
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