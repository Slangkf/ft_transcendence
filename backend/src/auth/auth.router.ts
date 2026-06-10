import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { Router } from "express";
import { valideRequest } from "../middleware/zod_check";
import { Register_Input, Login_Input } from "@shared/user.schema"
import { container } from "../container";

/*
 * Builds the /auth router: register and login (both Zod-validated) and logout.
 */
export function createAuthRouter(authService: AuthService): Router {
    const router = Router();
    const authController = new AuthController(authService);

    router.post('/register', valideRequest(Register_Input), authController.register);
    router.post('/login', valideRequest(Login_Input), authController.login);
    router.post('/logout', authController.logout);

    return router;
}
