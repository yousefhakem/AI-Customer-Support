import { Router } from "express";
import { vapiService } from "../../services/vapiService.js";

const router = Router();

// GET /api/private/vapi/assistants
router.get("/assistants", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const assistants = await vapiService.getAssistants(orgId);
    res.json(assistants);
  } catch (error) {
    next(error);
  }
});

// GET /api/private/vapi/phone-numbers
router.get("/phone-numbers", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const phoneNumbers = await vapiService.getPhoneNumbers(orgId);
    res.json(phoneNumbers);
  } catch (error) {
    next(error);
  }
});

export default router;
