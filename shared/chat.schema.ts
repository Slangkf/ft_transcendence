import {z} from 'zod'

export const sendMessageSchema = z.object({
    toUserId: z.coerce.number().int().positive(),
    contentn: z.string().min(1, "message connot be empty").max(2000, "message too long"),
})

export const getHistorySchema = z.object({
    withUserId: z.coerce.number().int().positive(),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    before: z.coerce.date()
})

export const markReadSchema = z.object({
    fromUserId: z.coerce.number().int().positive(),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetHistoryInput = z.infer<typeof getHistorySchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;