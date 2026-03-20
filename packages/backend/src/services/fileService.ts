import { BadRequestError, NotFoundError, UnauthorizedError } from "../lib/errors.js";
import { uploadToS3, getS3Url, deleteFromS3 } from "../lib/s3.js";
import { ragService } from "../ai/rag.js";
import { extractTextContent } from "../ai/extractTextContent.js";
import { subscriptionService } from "./subscriptionService.js";
import { createHash } from "crypto";
import type { PublicFile, PaginationParams } from "../types/index.js";

function guessMimeType(filename: string, mimeType?: string): string {
  if (mimeType) return mimeType;

  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    csv: "text/csv",
    md: "text/markdown",
  };

  return mimeMap[ext || ""] || "application/octet-stream";
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function contentHashFromBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export const fileService = {
  async addFile(data: {
    filename: string;
    mimeType: string;
    buffer: Buffer;
    category?: string;
    orgId: string;
  }) {
    // Check subscription
    const subscription = await subscriptionService.getByOrganizationId(data.orgId);

    if (subscription?.status !== "active") {
      throw new BadRequestError("Missing subscription");
    }

    const mimeType = guessMimeType(data.filename, data.mimeType);

    // Upload to S3
    const s3Key = await uploadToS3(data.buffer, data.filename, mimeType);

    // Extract text content for RAG
    const text = await extractTextContent({
      s3Key,
      filename: data.filename,
      buffer: data.buffer,
      mimeType,
    });

    const contentHash = contentHashFromBuffer(data.buffer);

    // Add to RAG index
    const { entryId, created } = await ragService.add({
      namespace: data.orgId,
      text,
      key: data.filename,
      title: data.filename,
      metadata: {
        s3Key,
        uploadedBy: data.orgId,
        filename: data.filename,
        category: data.category ?? null,
      },
      contentHash,
    });

    if (!created) {
      console.debug("Entry already exists, skipping upload metadata");
      await deleteFromS3(s3Key);
    }

    const url = await getS3Url(s3Key);

    return { url, entryId };
  },

  async deleteFile(entryId: string, orgId: string) {
    const namespace = await ragService.getNamespace(orgId);

    if (!namespace) {
      throw new UnauthorizedError("Invalid namespace");
    }

    const entry = await ragService.getEntry(entryId);

    if (!entry) {
      throw new NotFoundError("Entry not found");
    }

    const metadata = entry.metadata as {
      uploadedBy?: string;
      s3Key?: string;
    } | null;

    if (metadata?.uploadedBy !== orgId) {
      throw new UnauthorizedError("Invalid Organization ID");
    }

    // Delete from S3
    if (metadata?.s3Key) {
      await deleteFromS3(metadata.s3Key);
    }

    // Delete from RAG
    await ragService.deleteEntry(entryId);
  },

  async list(data: {
    orgId: string;
    category?: string;
    pagination: PaginationParams;
  }): Promise<{
    page: PublicFile[];
    nextCursor: string | null;
    isDone: boolean;
  }> {
    const namespace = await ragService.getNamespace(data.orgId);

    if (!namespace) {
      return { page: [], nextCursor: null, isDone: true };
    }

    const results = await ragService.list(data.orgId, {
      cursor: data.pagination.cursor,
      limit: data.pagination.limit,
    });

    const files: PublicFile[] = await Promise.all(
      results.page.map(async (entry) => {
        const metadata = entry.metadata as {
          s3Key?: string;
          uploadedBy?: string;
          filename?: string;
          category?: string | null;
        } | null;

        const filename = entry.key || "Unknown";
        const extension = filename.split(".").pop()?.toLowerCase() || "txt";

        let status: "ready" | "processing" | "error" = "error";
        if (entry.status === "ready") status = "ready";
        else if (entry.status === "pending") status = "processing";

        const url = metadata?.s3Key ? await getS3Url(metadata.s3Key) : null;

        return {
          id: entry.id,
          name: filename,
          type: extension,
          size: formatFileSize(entry.text.length), // Approximate
          status,
          url,
          category: metadata?.category || undefined,
        };
      }),
    );

    const filteredFiles = data.category
      ? files.filter((file) => file.category === data.category)
      : files;

    return {
      page: filteredFiles,
      nextCursor: results.nextCursor,
      isDone: results.isDone,
    };
  },
};
