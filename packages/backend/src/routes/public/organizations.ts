import { Router } from "express";
import { organizationService } from "../../services/organizationService.js";

const router = Router();

// POST /api/public/organizations/validate
router.post("/validate", async (req, res, next) => {
  try {
    const { organizationId } = req.body;
    const result = await organizationService.validate(organizationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
