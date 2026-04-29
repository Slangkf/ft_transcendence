import { FriendshipService } from './friendship.service';
import type { Request, Response } from 'express';
import { AppError, ErrorCode } from 'src/error/apperror';
import type { SendFriendRequestInput, UpdateStatusInput } from '@shared/friendship.schema';

export class FriendshipController {
    private friendshipService: FriendshipService;

    constructor() {
        this.friendshipService = new FriendshipService();
    }

    // Envoyer une demande d'ami
    SendFriendRequest = async (req: Request, res: Response) => {
        try {
            const input: SendFriendRequestInput = req.body;
            const result = await this.friendshipService.send_friend_request(req.user.id, input);
            res.json(result);
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            res.status(500).json({ message: "Internal send friend request error" });
        }
    };

    // Accepter une demande d'ami
    AcceptFriendRequest = async (req: Request, res: Response) => {
        try {
            const friendshipId = parseInt(req.params.friendshipId);
            const result = await this.friendshipService.accept_friend_request(req.user.id, friendshipId);
            res.json(result);
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            res.status(500).json({ message: "Internal accept friend request error" });
        }
    };

    // Refuser une demande d'ami
    DeclineFriendRequest = async (req: Request, res: Response) => {
        try {
            const friendshipId = parseInt(req.params.friendshipId);
            await this.friendshipService.decline_friend_request(req.user.id, friendshipId);
            res.json({ message: "Friend request declined" });
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            res.status(500).json({ message: "Internal decline friend request error" });
        }
    };

    // Supprimer un ami
    RemoveFriend = async (req: Request, res: Response) => {
        try {
            const friendId = parseInt(req.params.friendId);
            await this.friendshipService.remove_friend(req.user.id, friendId);
            res.json({ message: "Friend removed" });
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            res.status(500).json({ message: "Internal remove friend error" });
        }
    };

    // Obtenir la liste des amis
    GetFriends = async (req: Request, res: Response) => {
        try {
            const result = await this.friendshipService.get_friends(req.user.id);
            res.json(result);
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            res.status(500).json({ message: "Internal get friends error" });
        }
    };

    // Obtenir les demandes reçues
    GetPendingRequests = async (req: Request, res: Response) => {
        try {
            const result = await this.friendshipService.get_pending_requests(req.user.id);
            res.json(result);
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            res.status(500).json({ message: "Internal get pending requests error" });
        }
    };

    // Obtenir les demandes envoyées
    GetSentRequests = async (req: Request, res: Response) => {
        try {
            const result = await this.friendshipService.get_sent_requests(req.user.id);
            res.json(result);
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            res.status(500).json({ message: "Internal get sent requests error" });
        }
    };

    // Mettre à jour le statut en ligne/hors ligne
    UpdateOnlineStatus = async (req: Request, res: Response) => {
        try {
            const input: UpdateStatusInput = req.body;
            await this.friendshipService.update_online_status(req.user.id, input.status);
            res.json({ message: "Status updated" });
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            res.status(500).json({ message: "Internal update status error" });
        }
    };

    // Obtenir le statut d'un utilisateur
    GetUserStatus = async (req: Request, res: Response) => {
        try {
            const userId = parseInt(req.params.userId);
            const result = await this.friendshipService.get_user_status(userId);
            res.json(result);
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            res.status(500).json({ message: "Internal get user status error" });
        }
    };
}