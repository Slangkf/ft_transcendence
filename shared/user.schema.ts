import {z} from 'zod'

//type user for database 
export const User_DB = z.object({
    id: z.string().uuid(),
    username: z.string().min(3).max(20),
    email: z.string().email(),
    password: z.string(),
    createdAt: z.date()
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
    id: z.string().uuid(),
    username: z.string().min(3).max(20),
    email: z.string().email()
})
export type UserOutput = z.infer<typeof User_Output>;

//typpe to authendification
export const Auth_result = z.object({
    token: z.string(),
    user: User_Output
})
export type AuthResult = z.inder<typeof Auth_result>;