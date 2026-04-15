import { verifyToken } from "src/middleware/verify_token";
import {Router} from 'express'
import { UserController } from "./user.controller";

const router = Router();
const usercontroller = new UserController();

router.use(verifyToken);
router.get('/me', usercontroller.GetProfil)
router.post('/me/changepassword', usercontroller.ChangePassword)

export const UserRouter = router;