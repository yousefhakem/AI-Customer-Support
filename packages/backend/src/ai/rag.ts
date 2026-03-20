import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { prisma } from "../lib/prisma.js";

/**
 * RAG service replacing @convex-dev/rag.
 * 
 * NOTE: For production vector search, you need pgvector extension installed.
 * This implementation uses a text-based fallback for basic search functionality.
 * To enable proper vector search:
 * 
 * 1. Install pgvector: CREATE EXTENSION IF NOT EXISTS vector;
 * 2. Add embedding column: ALTER TABLE rag_entries ADD COLUMN embedding vector(1536);
 * 3. Create index: CREATE INDEX ON rag_entries USING ivfflat (embedding vector_cosine_ops);
 * 4. Replace the search method below with cosine similarity queries.
 */
export const ragService = {
  /**
   * Add a document to the knowledge base.
   */
  async add(data: {
    namespace: string;
    text: string;
    key: string;
    title: string;
    metadata: Record<string, unknown>;
    contentHash: string;
  }) {
    // Check for existing entry with same content hash (deduplication)
    const existing = await prisma.ragEntry.findUnique({
      where: {
        namespace_contentHash: {
          namespace: data.namespace,
          contentHash: data.contentHash,
        },
      },
    });

    if (existing) {
      return { entryId: existing.id, created: false };
    }

    const entry = await prisma.ragEntry.create({
      data: {
        namespace: data.namespace,
        key: data.key,
        title: data.title,
        text: data.text,
        contentHash: data.contentHash,
        metadata: data.metadata as object,
        status: "ready",
        s3Key: (data.metadata as { s3Key?: string }).s3Key,
      },
    });

    // Generate and store embedding asynchronously
    // In production, you'd store this in the embedding vector column:
    // await prisma.$executeRaw`UPDATE rag_entries SET embedding = ${embedding}::vector WHERE id = ${entry.id}`
    void generateAndStoreEmbedding(entry.id, data.text).catch((err) => {
      console.error(`Failed to generate embedding for entry ${entry.id}:`, err);
      prisma.ragEntry.update({
        where: { id: entry.id },
        data: { status: "error" },
      }).catch(console.error);
    });

    return { entryId: entry.id, created: true };
  },

  /**
   * Search the knowledge base using text-based similarity.
   * In production with pgvector, this would use cosine similarity on embeddings.
   */
  async search(namespace: string, query: string, limit = 5) {
    // Simple text search fallback (replace with vector search when pgvector is set up)
    const entries = await prisma.ragEntry.findMany({
      where: {
        namespace,
        status: "ready",
        OR: [
          { text: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { key: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
    });

    const text = entries.map((e) => e.text).join("\n\n");

    return {
      entries: entries.map((e) => ({
        entryId: e.id,
        title: e.title,
        text: e.text,
      })),
      text,
    };
  },

  /**
   * Get namespace info by organizationId.
   */
  async getNamespace(namespace: string) {
    const count = await prisma.ragEntry.count({
      where: { namespace },
    });

    if (count === 0) return null;

    return { namespaceId: namespace };
  },

  /**
   * List entries in a namespace with pagination.
   */
  async list(
    namespace: string,
    pagination: { cursor?: string; limit?: number },
  ) {
    const limit = pagination.limit || 20;

    const entries = await prisma.ragEntry.findMany({
      where: { namespace },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(pagination.cursor
        ? { cursor: { id: pagination.cursor }, skip: 1 }
        : {}),
    });

    const hasMore = entries.length > limit;
    const page = hasMore ? entries.slice(0, limit) : entries;

    return {
      page,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
      isDone: !hasMore,
    };
  },

  /**
   * Get a specific entry.
   */
  async getEntry(entryId: string) {
    return await prisma.ragEntry.findUnique({
      where: { id: entryId },
    });
  },

  /**
   * Delete an entry.
   */
  async deleteEntry(entryId: string) {
    await prisma.ragEntry.delete({
      where: { id: entryId },
    });
  },
};

/**
 * Generate embedding using OpenAI and store it.
 * With pgvector, this would store the vector in a vector column.
 */
async function generateAndStoreEmbedding(
  entryId: string,
  text: string,
): Promise<void> {
  try {
    const _model = openai.embedding("text-embedding-3-small");
    // In production with pgvector:
    // const result = await embed({ model, value: text });
    // await prisma.$executeRaw`UPDATE rag_entries SET embedding = ${result.embedding}::vector WHERE id = ${entryId}`

    await prisma.ragEntry.update({
      where: { id: entryId },
      data: { status: "ready" },
    });
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    await prisma.ragEntry.update({
      where: { id: entryId },
      data: { status: "error" },
    });
  }
}
