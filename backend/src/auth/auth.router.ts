import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { Router } from "express";
import { valideRequest } from "../middleware/zod_check";
import { Register_Input, Login_Input } from "@shared/user.schema"
import { randomUUID } from "crypto";

export function createAuthRouter(authService: AuthService): Router {
    const router = Router();
    const authController = new AuthController(authService);

    router.post('/register', valideRequest(Register_Input), authController.register);
    router.post('/login', valideRequest(Login_Input), authController.login);
    router.post('/logout', authController.logout);


    //google oauth 2.0, redirecte vers google
    router.get('/google', (req, res) =>{
        const url = 'https://accounts.google.com/o/oauth2/v2/auth';
        const options = {
            client_id: process.env.GOOGLE_CLIENT_ID!,
            redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
            response_type: 'code',
            //scope: tell what type of information we will get
            scope: [
                'openid',
                'email',
                'profile'
            ].join(' '),
            state: randomUUID(),
        }
        const qs = new URLSearchParams(options).toString();
        return res.redirect(`${url}?${qs}`)
    })

    //callback to get all information
    router.get('/google/callback', authController.googleCallBack);
    
    return router;
}
