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
    router.get('/google', authController.google);
    //callback to get all information
    router.get('/google/callback', authController.googleCallBack);

    //github 
    router.get('/github', authController.github);
    router.get('/github/callback', authController.githubCallBack);
    router.get('/me', authController.getMe);
    
    return router;
}
