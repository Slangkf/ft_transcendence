import { AuthController } from "./auth.controller";
import { Router } from "express";
import { valideRequest } from "../middleware/zod_check";
import { Register_Input, Login_Input } from "@shared/user.schema"
import multer from 'multer';

const router = Router();
const authController = new AuthController();
const upload = multer({ dest: 'uploads/' });

//router.post('/register', authController.register);
//router.post('/login', authController.login);


//version router with middleware
router.post('/register', valideRequest(Register_Input), authController.register);
router.post('/login', valideRequest(Login_Input), authController.login);
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);
router.post('/me/avatar', upload.single('avatar'), userController.updateAvatar);

export const AuthRouter = router; 
