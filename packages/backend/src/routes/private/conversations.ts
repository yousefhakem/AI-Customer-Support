import { Router } from "express";
import { conversationService } from "../../services/conversationService.js";
import type { ConversationStatus } from "../../types/index.js";

const router = Router();

// GET /api/private/conversations
router.get("/", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const { cursor, limit, status } = req.query;
    const result = await conversationService.getManyPrivate(
      orgId,
      {
        cursor: cursor as string | undefined,
        limit: limit ? Number(limit) : undefined,
      },
      status as ConversationStatus | undefined,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/private/conversations/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const result = await conversationService.getOnePrivate(req.params.id, orgId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/private/conversations/:id/status
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const { status } = req.body;
    await conversationService.updateStatus(
      req.params.id,
      status,
      orgId,
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
