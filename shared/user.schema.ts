import {z} from 'zod'

//type user for database 
export const User_DB = z.object({
    id: z.number().int(),
    username: z.string().min(3).max(20),
    email: z.string().email(),
    password: z.string(),
    createdAt: z.date(),
    url: z.string().max(512).nullable().optional(),
    score: z.number().int().nullable().optional(),
    wins: z.number().int().nullable().optional(),
    played: z.number().int().nullable().optional(),
    friendsNb: z.number().int().nullable().optional(),
    status: z.enum(['ONLINE', 'OFFLINE', 'AWAY', 'IN_GAME']).optional(),
    lastSeen: z.date().nullable().optional(),
    role: z.enum(['USER', 'ADMIN']).optional()
})
export type UserDB = z.infer<typeof User_DB>;

//type data from front
export const Register_Input = z.object({
    username: z.string().min(3).max(20),
    email: z.string().email(),
    password: z.string().min(8).max(20)
})
export type RegisterInput = z.infer<typeof Register_Input>;

//type for login
export const Login_Input = z.object({
    email: z.string().email(), 
    password: z.string().min(8)
})
export type LoginInput = z.infer<typeof Login_Input>;

//type output for front， without password
export const User_Output = z.object({
    id: z.number().int(),
    createdAt: z.date(),
    username: z.string().min(3).max(20),
    email: z.string().email(),
    url: z.string().max(512).nullable().optional(),
    score: z.number().int().nullable().optional(),
    wins: z.number().int().nullable().optional(),
    played: z.number().int().nullable().optional(),
    friendsNb: z.number().int().nullable().optional(),    status: z.enum(['ONLINE', 'OFFLINE', 'AWAY', 'IN_GAME']).optional(),
    lastSeen: z.date().nullable().optional(),    role: z.enum(['USER', 'ADMIN']).optional()
})
export type UserOutput = z.infer<typeof User_Output>;

//typpe to authendification
export const Auth_result = z.object({
    token: z.string(),
    user: User_Output
})
export type AuthResult = z.infer<typeof Auth_result>;

//type input for change password, only oldpassword and 2 new password
export const Change_Pd_Input = z.object({
    oldpassword: z.string().min(1),
    newpassword: z.string().min(3).max(20),
    confirmpd: z.string().min(3).max(20)
})
export type ChangePdInput = z.infer<typeof Change_Pd_Input>;

export const Change_Username_Input = z.object({
    newUsername: z.string().min(3).max(20)
})
export type ChangeUsernameInput = z.infer<typeof Change_Username_Input>;
