import { FriendshipService } from './friendship.service';
import type { Request, Response } from 'express';
import type { SendFriendRequestInput, UpdateStatusInput } from '@shared/friendship.schema';
import { Apiresponse } from '../lib/api_response';
import { AppError, ErrorCode } from '../error/apperror';

export class FriendshipController {

    constructor(private friendshipService: FriendshipService) {}

    /* POST /request handler. Sends a friend request to the target user. */
    SendFriendRequest = async (req: Request, res: Response) => {
        try {
            const input: SendFriendRequestInput = req.body;
            const result = await this.friendshipService.send_friend_request(Number(req.user!.id), input);
            res.json(Apiresponse.success(result, "Friend request sent"));
        } catch (error) {
            console.error("error send friend request: ", error);
            this.handleError(res, error, "Internal send friend request error");
        }
    };

    /* PUT /request/:friendshipId/accept handler. Accepts a received friend request. */
    AcceptFriendRequest = async (req: Request, res: Response) => {
        try {

            const friendshipId = parseInt(req.params.friendshipId as string) ;
            const result = await this.friendshipService.accept_friend_request(Number(req.user!.id), friendshipId);
            res.json(Apiresponse.success(result, "Friend request accepted"));
        } catch (error) {
            console.error("error accept: ", error);
            this.handleError(res, error, "Internal accept friend request error");
        }
    };

    /* DELETE /request/:friendshipId/decline handler. Declines a received friend request. */
    DeclineFriendRequest = async (req: Request, res: Response) => {
        try {
           const friendshipId = parseInt(req.params.friendshipId as string);
            await this.friendshipService.decline_friend_request(Number(req.user!.id), friendshipId);
            res.json(Apiresponse.success(null, "Friend request declined"));
        } catch (error) {
            console.error("error decline: ", error);
            this.handleError(res, error, "Internal decline friend request error");
        }
    };

    /* DELETE /friend/:friendId handler. Removes an existing friendship. */
    RemoveFriend = async (req: Request, res: Response) => {
        try {
            const friendId = parseInt(req.params.friendId as string);
            await this.friendshipService.remove_friend(Number(req.user!.id), friendId);
            res.json(Apiresponse.success(null, "Friend removed"));
        } catch (error) {
            console.error("error remove friend: ", error);
            this.handleError(res, error, "Internal remove friend error");
        }
    };

    /* GET /friends handler. Returns the caller's friend list. */
    GetFriends = async (req: Request, res: Response) => {
        try {
            const result = await this.friendshipService.get_friends(Number(req.user!.id));
            res.json(Apiresponse.success(result));
        } catch (error) {
            console.error("error get friends: ", error);
            this.handleError(res, error, "Internal get friends error");
        }
    };

	/* GET /friends/:username handler. Returns another user's friend list; 400 if no username. */
	GetFriendsForFriend = async (req: Request, res: Response) => {
        try {
            const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
            if (!username) {
                throw new AppError(
                    'username param is required',
                    ErrorCode.BAD_REQUEST,
                    400
                );
            }
            const result = await this.friendshipService.get_friends_for_friend(username);
            res.json(Apiresponse.success(result));
        } catch (error) {
            console.error("error get friends for friend: ", error);
            this.handleError(res, error, "Internal get friends for friend error");
        }
    };

    /* GET /requests/pending handler. Returns friend requests the caller received. */
    GetPendingRequests = async (req: Request, res: Response) => {
        try {
            const result = await this.friendshipService.get_pending_requests(Number(req.user!.id));
            res.json(Apiresponse.success(result));
        } catch (error) {
            console.error("error get pending requests: ", error);
            this.handleError(res, error, "Internal get pending requests error");
        }
    };

    /* GET /requests/sent handler. Returns friend requests the caller sent. */
    GetSentRequests = async (req: Request, res: Response) => {
        try {
            const result = await this.friendshipService.get_sent_requests(Number(req.user!.id));
            res.json(Apiresponse.success(result));
        } catch (error) {
            console.error("error get sent requests: ", error);
            this.handleError(res, error, "Internal get sent requests error");
        }
    };

    /* PUT /status handler. Updates the caller's ONLINE/OFFLINE status. */
    UpdateOnlineStatus = async (req: Request, res: Response) => {
        try {
            const input: UpdateStatusInput = req.body;
            await this.friendshipService.update_online_status(Number(req.user!.id), input.status);
            res.json(Apiresponse.success(null, "Status updated"));
        } catch (error) {
            console.error("error update status: ", error);
            this.handleError(res, error, "Internal update status error");
        }
    };

    /* GET /status/:userId handler. Returns a given user's presence status. */
    GetUserStatus = async (req: Request, res: Response) => {
        try {
            const userId = parseInt(req.params.userId as string);
            const result = await this.friendshipService.get_user_status(userId);
            res.json(Apiresponse.success(result));
        } catch (error) {
            console.error("error get user status: ", error);
            this.handleError(res, error, "Internal get user status error");
        }
    };

    /* Maps AppError to its status/code, otherwise replies 500 with defaultMessage. */
    private handleError(res: Response, error: any, defaultMessage: string) {
        console.error(error);
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