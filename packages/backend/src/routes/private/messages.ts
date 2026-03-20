import { Router } from "express";
import { messageService } from "../../services/messageService.js";

const router = Router();

// POST /api/private/messages
router.post("/", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const { prompt, conversationId } = req.body;
    await messageService.createPrivate({
      prompt,
      conversationId,
      orgId,
    });
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/private/messages
router.get("/", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const { threadId, cursor, limit } = req.query;
    const result = await messageService.getManyPrivate({
      threadId: threadId as string,
      orgId,
      cursor: cursor as string | undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/private/messages/enhance
router.post("/enhance", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const { prompt } = req.body;
    const enhanced = await messageService.enhanceResponse(prompt, orgId);
    res.json({ text: enhanced });
  } catch (error) {
    next(error);
  }
});

export default router;
