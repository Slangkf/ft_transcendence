import { verifyToken } from "src/middleware/verify_token";
import {Router} from 'express'
import { UserController } from "./user.controller";

const router = Router();
const usercontroller = new UserController();

router.get('/me', verifyToken, usercontroller.GetProfil)

export const UserRouter = router;