import { AuthController } from "./auth.controller";
import { Router } from "express";
import { valideRequest } from "src/middleware/zod_check";
import { Register_Input, Login_Input } from "@shared/user.schema"

const router = Router();
const authController = new AuthController();

//router.post('/register', authController.register);
//router.post('/login', authController.login);


//version router with middleware
router.post('/register', valideRequest(Register_Input), authController.register);
router.post('/login', valideRequest(Login_Input), authController.login);


export const AuthRouter = router; 