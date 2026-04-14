import { verifyToken } from "src/middleware/verify_token";
import {Router} from 'express'
import { UserController } from "./user.controller";

const router = Router();
const usercontroller = new UserController();

router.get('/me', verifyToken, usercontroller.GetProfil)
router.post('/me/changepassword', verifyToken, usercontroller.ChangePassword)

export const UserRouter = router;