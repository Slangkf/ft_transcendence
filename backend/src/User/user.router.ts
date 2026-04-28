import { verifyToken } from "src/middleware/verify_token";
import {Router} from 'express'
import { UserController } from "./user.controller";
import { handleAvatarUpload } from "../middleware/avatar_upload";

const router = Router();
const usercontroller = new UserController();

router.use(verifyToken);
router.get('/me', usercontroller.GetProfil)
router.post('/me/changepassword', usercontroller.ChangePassword)
router.post('/me/changeusername', usercontroller.ChangeUsername)
router.post('/me/avatar', handleAvatarUpload, usercontroller.UpdateAvatar)

export const UserRouter = router;
