import {z} from 'zod'

//type user for database 
export const User_DB = z.object({
    id: z.string().uuid(),
    username: z.string().min(3).max(20),
    email: z.string().email(),
    hashed_password: z.string(),
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
    identifiant: z.string().min(3), // username or email
    password: z.string().min(8)
})
export type LoginInput = z.infer<typeof Login_Input>;

//type output for front， without password, but with jasonwebtoken 
export const User_Output = z.object({
    id: z.string().uuid(),
    username: z.string().min(3).max(20),
    email: z.string().email(),
    token: z.string()
})
export type UserOutput = z.infer<typeof User_Output>;