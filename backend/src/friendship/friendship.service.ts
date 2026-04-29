import { FriendshipRepository } from './friendship.repository';
import { UserRepository } from '../User/user.repository';
import type { FriendshipOutput, SendFriendRequestInput, FriendshipStatus as FriendshipStatusType } from '@shared/friendship.schema';
import { AppError, ErrorCode } from 'src/error/apperror';

export class FriendshipService {
    private friendshipRepository: FriendshipRepository;
    private userRepository: UserRepository;

    constructor() {
        this.friendshipRepository = new FriendshipRepository();
        this.userRepository = new UserRepository();
    }

    // Envoyer une demande d'ami
    async send_friend_request(userId: number, input: SendFriendRequestInput): Promise<FriendshipOutput> {
        // Vérifier que l'utilisateur n'envoie pas de demande à lui-même
        if (userId === input.friendId) {
            throw new AppError("Cannot send friend request to yourself", 400);
        }

        // Vérifier que les deux utilisateurs existent
        const user = await this.userRepository.find_by_id(userId);
        const friend = await this.userRepository.find_by_id(input.friendId);

        if (!user || !friend) {
            throw new AppError("User not found", 404);
        }

        // Vérifier qu'il n'y a pas déjà une demande en cours ou une amitié existante
        const existingFriendship = await this.friendshipRepository.find_friendship_between_users(userId, input.friendId);
        if (existingFriendship) {
            if (existingFriendship.status === 'ACCEPTED') {
                throw new AppError("Already friends", 400);
            } else if (existingFriendship.status === 'PENDING') {
                throw new AppError("Friend request already sent", 400);
            }
        }

        // Créer la demande d'ami
        const friendship = await this.friendshipRepository.create_friend_request(userId, input.friendId);

        // Incrémenter friendsNb pour les deux utilisateurs (optionnel, peut être calculé dynamiquement)
        // await this.userRepository.increment_friends_count(userId);
        // await this.userRepository.increment_friends_count(input.friendId);

        return friendship;
    }

    // Accepter une demande d'ami
    async accept_friend_request(userId: number, friendshipId: number): Promise<FriendshipOutput> {
        const friendship = await this.friendshipRepository.find_by_id(friendshipId);

        if (!friendship) {
            throw new AppError("Friend request not found", 404);
        }

        // Vérifier que l'utilisateur est bien le destinataire de la demande
        if (friendship.friendId !== userId) {
            throw new AppError("Unauthorized to accept this friend request", 403);
        }

        // Vérifier que la demande est en attente
        if (friendship.status !== 'PENDING') {
            throw new AppError("Friend request is not pending", 400);
        }

        const updatedFriendship = await this.friendshipRepository.update_status(friendshipId, 'ACCEPTED');

        // Incrémenter friendsNb pour les deux utilisateurs
        await this.userRepository.increment_friends_count(friendship.userId);
        await this.userRepository.increment_friends_count(friendship.friendId);

        return updatedFriendship;
    }

    // Refuser une demande d'ami
    async decline_friend_request(userId: number, friendshipId: number): Promise<void> {
        const friendship = await this.friendshipRepository.find_by_id(friendshipId);

        if (!friendship) {
            throw new AppError("Friend request not found", 404);
        }

        // Vérifier que l'utilisateur est bien le destinataire de la demande
        if (friendship.friendId !== userId) {
            throw new AppError("Unauthorized to decline this friend request", 403);
        }

        // Vérifier que la demande est en attente
        if (friendship.status !== 'PENDING') {
            throw new AppError("Friend request is not pending", 400);
        }

        await this.friendshipRepository.delete_friendship(friendshipId);
    }

    // Supprimer un ami
    async remove_friend(userId: number, friendId: number): Promise<void> {
        const friendship = await this.friendshipRepository.find_friendship_between_users(userId, friendId);

        if (!friendship) {
            throw new AppError("Friendship not found", 404);
        }

        // Vérifier que l'utilisateur fait partie de l'amitié
        if (friendship.userId !== userId && friendship.friendId !== userId) {
            throw new AppError("Unauthorized to remove this friendship", 403);
        }

        // Vérifier que l'amitié est acceptée
        if (friendship.status !== 'ACCEPTED') {
            throw new AppError("Cannot remove non-accepted friendship", 400);
        }

        await this.friendshipRepository.delete_friendship(friendship.id);

        // Décrémenter friendsNb pour les deux utilisateurs
        await this.userRepository.decrement_friends_count(friendship.userId);
        await this.userRepository.decrement_friends_count(friendship.friendId);
    }

    // Obtenir la liste des amis d'un utilisateur
    async get_friends(userId: number): Promise<FriendshipOutput[]> {
        return await this.friendshipRepository.get_accepted_friendships(userId);
    }

    // Obtenir les demandes d'ami reçues (en attente)
    async get_pending_requests(userId: number): Promise<FriendshipOutput[]> {
        return await this.friendshipRepository.get_pending_requests(userId);
    }

    // Obtenir les demandes d'ami envoyées (en attente)
    async get_sent_requests(userId: number): Promise<FriendshipOutput[]> {
        return await this.friendshipRepository.get_sent_requests(userId);
    }

    // Mettre à jour le statut en ligne/hors ligne
    async update_online_status(userId: number, status: 'ONLINE' | 'OFFLINE' | 'AWAY' | 'IN_GAME'): Promise<void> {
        const lastSeen = status === 'OFFLINE' ? new Date() : null;
        await this.userRepository.update_status(userId, status, lastSeen);
    }

    // Obtenir le statut d'un utilisateur
    async get_user_status(userId: number): Promise<{ status: string; lastSeen: Date | null }> {
        const user = await this.userRepository.find_by_id(userId);
        if (!user) {
            throw new AppError("User not found", 404);
        }
        return {
            status: user.status || 'OFFLINE',
            lastSeen: user.lastSeen || null
        };
    }
}