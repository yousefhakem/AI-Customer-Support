import { Router } from "express";
import { contactSessionService } from "../../services/contactSessionService.js";

const router = Router();

// GET /api/private/contact-sessions/:conversationId
router.get("/:conversationId", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const result = await contactSessionService.getOneByConversationId(
      req.params.conversationId,
      orgId,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
