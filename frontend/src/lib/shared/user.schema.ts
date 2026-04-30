import {z} from 'zod'

//type data from front
export const Register_Input = z.object({
	email: z.string().email("Invalid format"),
    username: z.string().min(3, "Must be at least 3 characters").max(20, "Must not exceed 20 characters"),
    password: z.string().min(8, "Must be at least 8 characters").max(20, "Must not exceed 20 characters")
})
export type RegisterInput = z.infer<typeof Register_Input>;

//type for login
export const Login_Input = z.object({
    email: z.string().email("Invalid format"), 
    password: z.string().min(8, "Must be at least 8 characters").max(20, "Must not exceed 20 characters")
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
    friendsNb: z.number().int().nullable().optional(),
    role: z.enum(['USER', 'ADMIN']).optional()
})
export type UserOutput = z.infer<typeof User_Output>;

//type to authendification
export const Auth_result = z.object({
    token: z.string(),
    user: User_Output
})
export type AuthResult = z.infer<typeof Auth_result>;

//type input for change password, only oldpassword and 2 new password
export const Change_Pd_Input = z.object({
    newpassword: z.string().min(8, "Must be at least 8 characters").max(20, "Must not exceed 20 characters"),
    confirmpd: z.string().min(8, "Must be at least 8 characters").max(20, "Must not exceed 20 characters")
})
.refine((data) => data.newpassword === data.confirmpd, {
	path: ["confirmpd"],
	message: "Passwords do not match",
});
export type ChangePdInput = z.infer<typeof Change_Pd_Input>;

export const Change_Username_Input = z.object({
   username: z.string().min(3, "Must be at least 3 characters").max(20, "Must not exceed 20 characters")
})
export type ChangeUsernameInput = z.infer<typeof Change_Username_Input>;
