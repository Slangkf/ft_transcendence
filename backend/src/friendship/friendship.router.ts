import { Router } from 'express';
import { FriendshipController } from './friendship.controller';
import { verifyToken } from '../middleware/verify_token';
import { valideRequest } from "../middleware/zod_check";
import { Send_Friend_Request_Input, Update_Status_Input } from '@shared/friendship.schema';

const friendshipRouter = Router();
const friendshipController = new FriendshipController();

friendshipRouter.use(verifyToken);
friendshipRouter.post('/request', valideRequest(Send_Friend_Request_Input), friendshipController.SendFriendRequest);

friendshipRouter.put('/request/:friendshipId/accept', friendshipController.AcceptFriendRequest);
friendshipRouter.put('/status', valideRequest(Update_Status_Input), friendshipController.UpdateOnlineStatus);

friendshipRouter.delete('/request/:friendshipId/decline', friendshipController.DeclineFriendRequest);
friendshipRouter.delete('/friend/:friendId', friendshipController.RemoveFriend);

friendshipRouter.get('/friends', friendshipController.GetFriends);
friendshipRouter.get('/requests/pending', friendshipController.GetPendingRequests);
friendshipRouter.get('/requests/sent', friendshipController.GetSentRequests);
friendshipRouter.get('/status/:userId', friendshipController.GetUserStatus);

export default friendshipRouter;