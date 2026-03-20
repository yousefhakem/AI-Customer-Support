import { prisma } from "../lib/prisma.js";
import type { MessageRole } from "../types/index.js";

/**
 * Agent service replaces @convex-dev/agent functionality.
 * Manages AI threads and messages using PostgreSQL instead of Convex's built-in storage.
 */
export const agentService = {
  /**
   * Create a new conversation thread.
   */
  async createThread(userId: string) {
    const thread = await prisma.thread.create({
      data: { userId },
    });
    return thread;
  },

  /**
   * Save a message to a thread.
   */
  async saveMessage(
    threadId: string,
    message: {
      role: MessageRole;
      content: string;
      agentName?: string;
    },
  ) {
    const saved = await prisma.message.create({
      data: {
        threadId,
        role: message.role,
        content: message.content,
        agentName: message.agentName,
      },
    });
    return saved;
  },

  /**
   * Get the last message in a thread.
   */
  async getLastMessage(threadId: string) {
    const message = await prisma.message.findFirst({
      where: { threadId },
      orderBy: { createdAt: "desc" },
    });
    return message;
  },

  /**
   * List messages in a thread with cursor-based pagination.
   */
  async listMessages(
    threadId: string,
    pagination: { cursor?: string | null; limit?: number },
  ) {
    const limit = pagination.limit || 50;

    const messages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(pagination.cursor
        ? { cursor: { id: pagination.cursor }, skip: 1 }
        : {}),
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;

    return {
      page,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
      isDone: !hasMore,
    };
  },

  /**
   * Get all messages for a thread (for AI context).
   */
  async getAllMessages(threadId: string) {
    return await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });
  },
};
