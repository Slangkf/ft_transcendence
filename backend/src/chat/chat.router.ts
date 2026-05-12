import { Router } from "express";
import { ChatController } from "./chat.controller";
import { verifyToken } from "src/middleware/verify_token";

export function createChatRouter(controller: ChatController): Router{
    const router = Router();

    router.use(verifyToken);

    // GET /api/chat/history/:withUserId?limit=50&before=2024-01-01
    router.get('/history/:withUserId', controller.getHistory);

    return router;
}