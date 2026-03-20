import { Router } from "express";
import { pluginService } from "../../services/pluginService.js";

const router = Router();

// GET /api/private/plugins/:service
router.get("/:service", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const result = await pluginService.getOne(orgId, req.params.service);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/private/plugins/:service
router.delete("/:service", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    await pluginService.remove(orgId, req.params.service);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
