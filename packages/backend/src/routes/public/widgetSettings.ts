import { Router } from "express";
import { widgetSettingsService } from "../../services/widgetSettingsService.js";

const router = Router();

// GET /api/public/widget-settings
router.get("/", async (req, res, next) => {
  try {
    const { organizationId } = req.query;
    const settings = await widgetSettingsService.getByOrganizationId(
      organizationId as string,
    );
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

export default router;
