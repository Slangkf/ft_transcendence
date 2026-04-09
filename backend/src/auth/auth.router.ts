import { AuthController } from "./auth.controller";
import { Router } from "express";

const router = Router();
const authController = new AuthController();

router.post('/register', authController.register);
router.post('/login', authController.login);

export const AuthRouter = router; 