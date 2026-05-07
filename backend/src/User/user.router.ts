import { verifyToken } from "src/middleware/verify_token";
import {Router} from 'express'
import { UserController } from "./user.controller";
import { handleAvatarUpload } from "../middleware/avatar_upload";
import { userService } from "src/container";

const router = Router();
const usercontroller = new UserController(userService);

router.use(verifyToken);
router.get('/me', usercontroller.GetProfil)
router.get('/:userId', usercontroller.GetProfilById)
router.get('/username/:username', usercontroller.GetProfilByUsername)
router.post('/me/changepassword', usercontroller.ChangePassword)
router.post('/me/changeusername', usercontroller.ChangeUsername)
router.post('/me/avatar', handleAvatarUpload, usercontroller.UpdateAvatar)

export const UserRouter = router;
