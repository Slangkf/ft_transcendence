import {Router} from 'express'
import { UserController } from "./user.controller";
import { handleAvatarUpload } from "../middleware/avatar_upload";
import { verifyToken } from '../middleware/verify_token';
import { UserService } from './user.service';
import { valideRequest } from 'src/middleware/zod_check';
import {Get_Profil_by_Username,
    Change_Username_Input,
    Get_Profil_by_Id,
    Change_pd_request
} from "@shared/user.schema";


export function createUserRouter(userService: UserService): Router{
    const router = Router();
    const usercontroller = new UserController(userService);

    router.use(verifyToken);
    router.get('/me', usercontroller.GetProfil)
    router.get('/:userId', valideRequest(Get_Profil_by_Id), usercontroller.GetProfilById)
    router.get('/username/:username', valideRequest(Get_Profil_by_Username), usercontroller.GetProfilByUsername)
    router.post('/me/changepassword', valideRequest(Change_pd_request), usercontroller.ChangePassword)
    router.post('/me/changeusername', valideRequest(Change_Username_Input), usercontroller.ChangeUsername)
    router.post('/me/avatar', handleAvatarUpload, usercontroller.UpdateAvatar)

    return router;
}