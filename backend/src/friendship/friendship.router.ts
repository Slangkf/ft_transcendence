import { Router } from 'express';
import { FriendshipController } from './friendship.controller';
import { verifyToken } from '../middleware/verify_token';
import { valideRequest } from "../middleware/zod_check";
import { Send_Friend_Request_Input, Update_Status_Input } from '@shared/friendship.schema';


export function createFriendshipRouter(
    friendshipController: FriendshipController
){
    const router = Router();
    
    router.use(verifyToken);
    router.post('/request', valideRequest(Send_Friend_Request_Input), friendshipController.SendFriendRequest);
    router.put('/request/:friendshipId/accept', friendshipController.AcceptFriendRequest);
    router.put('/status', valideRequest(Update_Status_Input), friendshipController.UpdateOnlineStatus);

    router.delete('/request/:friendshipId/decline', friendshipController.DeclineFriendRequest);
    router.delete('/friend/:friendId', friendshipController.RemoveFriend);

    router.get('/friends', friendshipController.GetFriends);
    router.get('/requests/pending', friendshipController.GetPendingRequests);
    router.get('/requests/sent', friendshipController.GetSentRequests);
    router.get('/status/:userId', friendshipController.GetUserStatus);

    return router;

}