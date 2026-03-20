import { Router } from "express";
import { vapiService } from "../../services/vapiService.js";

const router = Router();

// GET /api/public/secrets/vapi
router.get("/vapi", async (req, res, next) => {
  try {
    const { organizationId } = req.query;
    const publicKey = await vapiService.getPublicKey(organizationId as string);

    if (!publicKey) {
      res.json(null);
      return;
    }

    res.json({ publicApiKey: publicKey });
  } catch (error) {
    next(error);
  }
});

export default router;
