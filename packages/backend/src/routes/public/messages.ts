import { Router } from "express";
import { messageService } from "../../services/messageService.js";

const router = Router();

// POST /api/public/messages
router.post("/", async (req, res, next) => {
  try {
    const { prompt, threadId, contactSessionId } = req.body;
    await messageService.createPublic({ prompt, threadId, contactSessionId });
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/public/messages
router.get("/", async (req, res, next) => {
  try {
    const { threadId, contactSessionId, cursor, limit } = req.query;
    const result = await messageService.getManyPublic({
      threadId: threadId as string,
      contactSessionId: contactSessionId as string,
      cursor: cursor as string | undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
