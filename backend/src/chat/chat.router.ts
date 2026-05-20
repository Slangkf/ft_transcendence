import { Router } from "express";
import { ChatController } from "./chat.controller";
import { verifyToken } from "../middleware/verify_token";
import { valideRequest } from "../middleware/zod_check";
import { getHistorySchema } from "@shared/chat.schema";


export function createChatRouter(controller: ChatController): Router{
    const router = Router();

    router.use(verifyToken);

    // GET /api/chat/history/:withUserId?limit=50&before=2024-01-01
    router.get('/history/:withUserId', valideRequest(getHistorySchema), controller.getHistory);

    // GET /api/chat/unread
    router.get('/unread', controller.getUnreadCount);

    return router;
}