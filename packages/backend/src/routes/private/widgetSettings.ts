import { Router } from "express";
import { widgetSettingsService } from "../../services/widgetSettingsService.js";

const router = Router();

// GET /api/private/widget-settings
router.get("/", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const settings = await widgetSettingsService.getOne(orgId);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

// PUT /api/private/widget-settings
router.put("/", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const { greetMessage, defaultSuggestions, vapiSettings } = req.body;
    await widgetSettingsService.upsert(orgId, {
      greetMessage,
      defaultSuggestions,
      vapiSettings,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
