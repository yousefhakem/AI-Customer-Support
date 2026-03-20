import { Router } from "express";
import { fileService } from "../../services/fileService.js";

const router = Router();

// POST /api/private/files
router.post("/", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const { filename, mimeType, bytes, category } = req.body;

    // Convert base64-encoded bytes to Buffer
    const buffer = Buffer.from(bytes, "base64");

    const result = await fileService.addFile({
      filename,
      mimeType,
      buffer,
      category,
      orgId,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/private/files/:entryId
router.delete("/:entryId", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    await fileService.deleteFile(req.params.entryId, orgId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/private/files
router.get("/", async (req, res, next) => {
  try {
    const { orgId } = req.auth!;
    const { category, cursor, limit } = req.query;
    const result = await fileService.list({
      orgId,
      category: category as string | undefined,
      pagination: {
        cursor: cursor as string | undefined,
        limit: limit ? Number(limit) : undefined,
      },
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
