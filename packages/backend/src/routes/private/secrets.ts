import { Router } from "express";
import { secretService } from "../../services/secretService.js";

const router = Router();

// POST /api/private/secrets
router.post("/", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const { service, value } = req.body;
    await secretService.upsert({
      organizationId: orgId,
      service,
      value,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
