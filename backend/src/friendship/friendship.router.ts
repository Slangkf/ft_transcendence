import { Router } from 'express';
import { FriendshipController } from './friendship.controller';
import { verifyToken } from '../middleware/verify_token';
import { zod_check } from '../middleware/zod_check';
import { Send_Friend_Request_Input, Update_Status_Input } from '@shared/friendship.schema';

const friendshipRouter = Router();
const friendshipController = new FriendshipController();

// Toutes les routes nécessitent une authentification
friendshipRouter.use(verifyToken);

// Envoyer une demande d'ami
friendshipRouter.post('/request', zod_check(Send_Friend_Request_Input), friendshipController.SendFriendRequest);

// Accepter une demande d'ami
friendshipRouter.put('/request/:friendshipId/accept', friendshipController.AcceptFriendRequest);

// Refuser une demande d'ami
friendshipRouter.delete('/request/:friendshipId/decline', friendshipController.DeclineFriendRequest);

// Supprimer un ami
friendshipRouter.delete('/friend/:friendId', friendshipController.RemoveFriend);

// Obtenir la liste des amis
friendshipRouter.get('/friends', friendshipController.GetFriends);

// Obtenir les demandes reçues
friendshipRouter.get('/requests/pending', friendshipController.GetPendingRequests);

// Obtenir les demandes envoyées
friendshipRouter.get('/requests/sent', friendshipController.GetSentRequests);

// Mettre à jour le statut en ligne/hors ligne
friendshipRouter.put('/status', zod_check(Update_Status_Input), friendshipController.UpdateOnlineStatus);

// Obtenir le statut d'un utilisateur
friendshipRouter.get('/status/:userId', friendshipController.GetUserStatus);

export default friendshipRouter;