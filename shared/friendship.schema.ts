import { z } from 'zod';

// Input pour envoyer une demande d'ami
export const Send_Friend_Request_Input = z.object({
    friendId: z.number().int()
});
export type SendFriendRequestInput = z.infer<typeof Send_Friend_Request_Input>;

// Output pour une amitié
export const Friendship_Output = z.object({
    id: z.number().int(),
    createdAt: z.date(),
    updatedAt: z.date(),
    userId: z.number().int(),
    friendId: z.number().int(),
    status: z.enum(['PENDING', 'ACCEPTED', 'BLOCKED']),
    user: z.object({
        id: z.number().int(),
        username: z.string(),
        url: z.string().nullable().optional(),
        status: z.enum(['ONLINE', 'OFFLINE', 'AWAY', 'IN_GAME']).optional(),
        lastSeen: z.date().nullable().optional()
    }).optional(),
    friend: z.object({
        id: z.number().int(),
        username: z.string(),
        url: z.string().nullable().optional(),
        status: z.enum(['ONLINE', 'OFFLINE', 'AWAY', 'IN_GAME']).optional(),
        lastSeen: z.date().nullable().optional()
    }).optional()
});
export type FriendshipOutput = z.infer<typeof Friendship_Output>;

// Input pour mettre à jour le statut
export const Update_Status_Input = z.object({
    status: z.enum(['ONLINE', 'OFFLINE', 'AWAY', 'IN_GAME'])
});
export type UpdateStatusInput = z.infer<typeof Update_Status_Input>;