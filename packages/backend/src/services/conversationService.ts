import { prisma } from "../lib/prisma.js";
import { NotFoundError, UnauthorizedError, BadRequestError } from "../lib/errors.js";
import { agentService } from "../ai/agent.js";
import type { ConversationStatus, PaginationParams, PaginatedResponse } from "../types/index.js";
import { contactSessionService } from "./contactSessionService.js";
import { widgetSettingsService } from "./widgetSettingsService.js";

export const conversationService = {
  // ─── Public (session-based) ───────────────────────────────────────────

  async getManyByContactSession(
    contactSessionId: string,
    pagination: PaginationParams,
  ) {
    const contactSession = await prisma.contactSession.findUnique({
      where: { id: contactSessionId },
    });

    if (!contactSession || contactSession.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid session");
    }

    const limit = pagination.limit || 20;

    const conversations = await prisma.conversation.findMany({
      where: { contactSessionId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
    });

    const hasMore = conversations.length > limit;
    const page = hasMore ? conversations.slice(0, limit) : conversations;

    const conversationsWithLastMessage = await Promise.all(
      page.map(async (conversation) => {
        const lastMessage = await agentService.getLastMessage(conversation.threadId);

        return {
          id: conversation.id,
          createdAt: conversation.createdAt,
          status: conversation.status,
          organizationId: conversation.organizationId,
          threadId: conversation.threadId,
          lastMessage,
        };
      }),
    );

    return {
      page: conversationsWithLastMessage,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
      isDone: !hasMore,
    };
  },

  async getOnePublic(conversationId: string, contactSessionId: string) {
    const session = await prisma.contactSession.findUnique({
      where: { id: contactSessionId },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid session");
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    if (conversation.contactSessionId !== session.id) {
      throw new UnauthorizedError("Incorrect session");
    }

    return {
      id: conversation.id,
      status: conversation.status,
      threadId: conversation.threadId,
    };
  },

  async createPublic(organizationId: string, contactSessionId: string) {
    const session = await prisma.contactSession.findUnique({
      where: { id: contactSessionId },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid session");
    }

    // Refresh session if needed
    await contactSessionService.refresh(contactSessionId);

    // Get widget settings for greet message
    const widgetSettings = await widgetSettingsService.getByOrganizationId(organizationId);

    // Create AI thread
    const thread = await agentService.createThread(organizationId);

    // Save greeting message
    await agentService.saveMessage(thread.id, {
      role: "assistant",
      content: widgetSettings?.greetMessage || "Hello, how can I help you today?",
    });

    // Create conversation record
    const conversation = await prisma.conversation.create({
      data: {
        contactSessionId: session.id,
        status: "unresolved",
        organizationId,
        threadId: thread.id,
      },
    });

    return conversation.id;
  },

  // ─── Private (auth-required) ──────────────────────────────────────────

  async updateStatus(
    conversationId: string,
    status: ConversationStatus,
    orgId: string,
  ) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    if (conversation.organizationId !== orgId) {
      throw new UnauthorizedError("Invalid Organization ID");
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });
  },

  async getOnePrivate(conversationId: string, orgId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contactSession: true },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    if (conversation.organizationId !== orgId) {
      throw new UnauthorizedError("Invalid Organization ID");
    }

    return {
      ...conversation,
      contactSession: conversation.contactSession,
    };
  },

  async getManyPrivate(
    orgId: string,
    pagination: PaginationParams,
    status?: ConversationStatus,
  ) {
    const limit = pagination.limit || 20;

    const whereClause: Record<string, unknown> = {
      organizationId: orgId,
    };
    if (status) {
      whereClause.status = status;
    }

    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      include: { contactSession: true },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
    });

    const hasMore = conversations.length > limit;
    const page = hasMore ? conversations.slice(0, limit) : conversations;

    const conversationsWithData = await Promise.all(
      page.map(async (conversation) => {
        const lastMessage = await agentService.getLastMessage(conversation.threadId);

        return {
          ...conversation,
          lastMessage,
          contactSession: conversation.contactSession,
        };
      }),
    );

    const validConversations = conversationsWithData.filter(
      (conv) => conv.contactSession !== null,
    );

    return {
      page: validConversations,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
      isDone: !hasMore,
    };
  },

  // ─── Internal (system-level) ──────────────────────────────────────────

  async escalateByThreadId(threadId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { threadId },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "escalated" },
    });
  },

  async resolveByThreadId(threadId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { threadId },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "resolved" },
    });
  },

  async getByThreadId(threadId: string) {
    return await prisma.conversation.findFirst({
      where: { threadId },
    });
  },
};
