import { Router } from "express";
import { conversationService } from "../../services/conversationService.js";

const router = Router();

// GET /api/public/conversations
router.get("/", async (req, res, next) => {
  try {
    const { contactSessionId, cursor, limit } = req.query;
    const result = await conversationService.getManyByContactSession(
      contactSessionId as string,
      {
        cursor: cursor as string | undefined,
        limit: limit ? Number(limit) : undefined,
      },
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/public/conversations/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { contactSessionId } = req.query;
    const result = await conversationService.getOnePublic(
      req.params.id,
      contactSessionId as string,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/public/conversations
router.post("/", async (req, res, next) => {
  try {
    const { organizationId, contactSessionId } = req.body;
    const conversationId = await conversationService.createPublic(
      organizationId,
      contactSessionId,
    );
    res.status(201).json({ conversationId });
  } catch (error) {
    next(error);
  }
});

export default router;
