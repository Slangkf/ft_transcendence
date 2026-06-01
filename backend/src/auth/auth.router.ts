import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { Router } from "express";
import { valideRequest } from "../middleware/zod_check";
import { Register_Input, Login_Input } from "@shared/user.schema"
import { container } from "../container";

export function createAuthRouter(authService: AuthService): Router {
    const router = Router();
    const authController = new AuthController(authService);

    router.post('/register', valideRequest(Register_Input), authController.register);
    router.post('/login', valideRequest(Login_Input), authController.login);
    router.post('/logout', authController.logout);

    router.get('/github', (req, res)=> {
        const url_base  = "https://github.com/login/oauth/authorize";
        console.log("clientid: ", process.env.GITHUB_CLIENT_ID);
        console.log("secret: ", process.env.GITHUB_CLIENT_SECRET);
        console.log("url: ", process.env.GITHUB_CALLBACK_URL);

        const params = new URLSearchParams({
            client_id : process.env.GITHUB_CLIENT_ID!,
            redirect_uri : process.env.GITHUB_CALLBACK_URL!,
            scope: 'read:user user:email',

        })
        res.redirect(`${url_base}?${params.toString()}`);
    })

    router.get('/github/callback', authController.githubCallback);
    router.get('/me', authController.getMe);
    return router;
}
