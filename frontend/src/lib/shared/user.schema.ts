import {z} from 'zod'

// Backend: Database schema representing a user entity
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
    role: z.enum(['USER', 'ADMIN']).optional()
})
export type UserDB = z.infer<typeof User_DB>;

// Frontend: Input schema used during user registration
export const Register_Input = z.object({
    username: z.string().min(3).max(20),
    email: z.string().email(),
    password: z.string().min(8).max(20)
})
export type RegisterInput = z.infer<typeof Register_Input>;

// Frontend: Input schema used for user login
export const Login_Input = z.object({
    email: z.string().email(), 
    password: z.string().min(8)
})
export type LoginInput = z.infer<typeof Login_Input>;

// Frontend: Public user schema without exposing the password
export const User_Output = z.object({
    id: z.number().int(),
    createdAt: z.date(),
    username: z.string().min(3).max(20),
    email: z.string().email(),
    url: z.string().max(512).nullable().optional(),
    score: z.number().int().nullable().optional(),
    wins: z.number().int().nullable().optional(),
    played: z.number().int().nullable().optional(),
    friendsNb: z.number().int().nullable().optional(),    status: z.enum(['ONLINE', 'OFFLINE', 'AWAY', 'IN_GAME']).optional()
})
export type UserOutput = z.infer<typeof User_Output>;

// Backend/Frontend: Authentication result returned after login or registration
export const Auth_result = z.object({
    token: z.string(),
    user: User_Output
})
export type AuthResult = z.infer<typeof Auth_result>;

// Frontend: Input schema for changing a password
export const Change_Pd_Input = z.object({
    oldpassword: z.string().min(8, "Must be at least 8 characters").max(20, "Must not exceed 20 characters"),
    newpassword: z.string().min(8, "Must be at least 8 characters").max(20, "Must not exceed 20 characters"),
    confirmpd: z.string().min(8, "Must be at least 8 characters").max(20, "Must not exceed 20 characters")
})
.refine(
    (data:{
        oldpassword: string
        newpassword: string
        confirmpd: string
}) => data.newpassword === data.confirmpd, {
	path: ["confirmpd"],
	message: "Passwords do not match",
});
export type ChangePdInput = z.infer<typeof Change_Pd_Input>;

// Backend: Request schema used to process password changes
export const Change_pd_request = z.object({
    oldpassword: z.string().min(8, "Must be at least 8 characters").max(20, "Must not exceed 20 characters"),
    newpassword: z.string().min(8, "Must be at least 8 characters").max(20, "Must not exceed 20 characters"),
    confirmpd: z.string().min(8, "Must be at least 8 characters").max(20, "Must not exceed 20 characters")
})
.refine(
    (data:{
        oldpassword: string
        newpassword: string
        confirmpd: string
}) => data.newpassword === data.confirmpd, {
	path: ["confirmpd"],
	message: "Passwords do not match",
});

// Frontend: Input schema for changing a username
export const Change_Username_Input = z.object({
   username: z.string().min(3, "Must be at least 3 characters").max(20, "Must not exceed 20 characters")
})
export type ChangeUsernameInput = z.infer<typeof Change_Username_Input>;

// Frontend: Input schema for retrieving a profile by username
export const Get_Profil_by_Username = z.object({
   username: z.string().min(3, "Must be at least 3 characters").max(20, "Must not exceed 20 characters")
})
export type GetProfilByUsernameInput = z.infer<typeof Get_Profil_by_Username>

// Frontend/Backend: Input schema for retrieving a profile by user ID
export const Get_Profil_by_Id = z.object({
    userId: z.coerce.number().int().positive(),
})
export type GetProfilByIdInput = z.infer<typeof Get_Profil_by_Id>;