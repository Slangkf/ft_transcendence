import {z} from 'zod'

// Zod schema for sending a message.
export const sendMessageSchema = z.object({
    toUserId: z.coerce.number().int().positive(),
    contentn: z.string().min(1, "message cannot be empty").max(2000, "message too long"),
})
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// Zod schema for fetching chat history with pagination support.
export const getHistorySchema = z.object({
    withUserId: z.coerce.number().int().positive(),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    before: z.coerce.date()
})
export type GetHistoryInput = z.infer<typeof getHistorySchema>;

// Zod schema for marking messages as read from a given sender.
export const markReadSchema = z.object({
    fromUserId: z.coerce.number().int().positive(),
})
export type MarkReadInput = z.infer<typeof markReadSchema>;

// Zod schema and DTO type for a chat message returned by the backend.
export const ChatMessage = z.object({
    messageId: z.string(),
    fromUserId: z.string(),
    toUserId: z.string(),
    content: z.string().min(1, "message cannot be empty").max(2000, "message too long"),
    createdAt: z.date()
})
export type ChatMessageDTO = z.infer<typeof ChatMessage>;