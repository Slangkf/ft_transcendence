import { verifyToken } from "src/middleware/verify_token";
import { RoomController } from "./room.controller";
import { Router } from 'express';
import { RoomService } from "./room.service";
import { RoomManager } from "./room.manager";

const router = Router();
const roomservice = new RoomService();
const roommanager = new RoomManager(roomservice);
const roomcontroller = new RoomController(roommanager);

router.use(verifyToken);
router.post('/entry', roomcontroller.EntryRoom);

export const RoomRouter = router;
