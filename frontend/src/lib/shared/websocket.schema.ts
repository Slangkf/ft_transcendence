import {z} from 'zod'

// Base schema used for all socket or API messages.
// The `type` field identifies the kind of message being transmitted.
export const Base_Message = z.object({
    type: z.string(),
    
})