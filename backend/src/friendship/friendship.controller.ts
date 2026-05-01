import { FriendshipService } from './friendship.service';
import type { Request, Response } from 'express';
import { AppError, ErrorCode } from 'src/error/apperror';
import { Apiresponse } from "src/lib/api_response";
import type { SendFriendRequestInput, UpdateStatusInput } from '@shared/friendship.schema';

export class FriendshipController {
    private friendshipService: FriendshipService;

    constructor() {
        this.friendshipService = new FriendshipService();
    }

    SendFriendRequest = async (req: Request, res: Response) => {
        try {
            const input: SendFriendRequestInput = req.body;
            const result = await this.friendshipService.send_friend_request(req.user.id, input);
            res.json(Apiresponse.success(result, "Friend request sent"));
        } catch (error) {
            this.handleError(res, error, "Internal send friend request error");
        }
    };

    AcceptFriendRequest = async (req: Request, res: Response) => {
        try {
            const friendshipId = parseInt(req.params.friendshipId);
            const result = await this.friendshipService.accept_friend_request(req.user.id, friendshipId);
            res.json(Apiresponse.success(result, "Friend request accepted"));
        } catch (error) {
            this.handleError(res, error, "Internal accept friend request error");
        }
    };

    DeclineFriendRequest = async (req: Request, res: Response) => {
        try {
            const friendshipId = parseInt(req.params.friendshipId);
            await this.friendshipService.decline_friend_request(req.user.id, friendshipId);
            res.json(Apiresponse.success(null, "Friend request declined"));
        } catch (error) {
            this.handleError(res, error, "Internal decline friend request error");
        }
    };

    RemoveFriend = async (req: Request, res: Response) => {
        try {
            const friendId = parseInt(req.params.friendId);
            await this.friendshipService.remove_friend(req.user.id, friendId);
            res.json(Apiresponse.success(null, "Friend removed"));
        } catch (error) {
            this.handleError(res, error, "Internal remove friend error");
        }
    };

    GetFriends = async (req: Request, res: Response) => {
        try {
            const result = await this.friendshipService.get_friends(req.user.id);
            res.json(Apiresponse.success(result));
        } catch (error) {
            this.handleError(res, error, "Internal get friends error");
        }
    };

    GetPendingRequests = async (req: Request, res: Response) => {
        try {
            const result = await this.friendshipService.get_pending_requests(req.user.id);
            res.json(Apiresponse.success(result));
        } catch (error) {
            this.handleError(res, error, "Internal get pending requests error");
        }
    };

    GetSentRequests = async (req: Request, res: Response) => {
        try {
            const result = await this.friendshipService.get_sent_requests(req.user.id);
            res.json(Apiresponse.success(result));
        } catch (error) {
            this.handleError(res, error, "Internal get sent requests error");
        }
    };

    UpdateOnlineStatus = async (req: Request, res: Response) => {
        try {
            const input: UpdateStatusInput = req.body;
            await this.friendshipService.update_online_status(req.user.id, input.status);
            res.json(Apiresponse.success(null, "Status updated"));
        } catch (error) {
            this.handleError(res, error, "Internal update status error");
        }
    };

    GetUserStatus = async (req: Request, res: Response) => {
        try {
            const userId = parseInt(req.params.userId);
            const result = await this.friendshipService.get_user_status(userId);
            res.json(Apiresponse.success(result));
        } catch (error) {
            this.handleError(res, error, "Internal get user status error");
        }
    };

    private handleError(res: Response, error: any, defaultMessage: string) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json(
                Apiresponse.error(error.code, error.message)
            );
        }
        res.status(500).json(
            Apiresponse.error(ErrorCode.INTERNAL_ERROR, defaultMessage)
        );
    }
}