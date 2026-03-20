import { Router } from "express";
import { contactSessionService } from "../../services/contactSessionService.js";

const router = Router();

// POST /api/public/contact-sessions
router.post("/", async (req, res, next) => {
  try {
    const { name, email, organizationId, metadata } = req.body;
    const session = await contactSessionService.create({
      name,
      email,
      organizationId,
      metadata,
    });
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

// POST /api/public/contact-sessions/validate
router.post("/validate", async (req, res, next) => {
  try {
    const { contactSessionId } = req.body;
    const result = await contactSessionService.validate(contactSessionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
