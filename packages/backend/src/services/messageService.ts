import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../lib/errors.js";
import { agentService } from "../ai/agent.js";
import { runSupportAgent } from "../ai/tools.js";
import { OPERATOR_MESSAGE_ENHANCEMENT_PROMPT } from "../ai/constants.js";
import { contactSessionService } from "./contactSessionService.js";
import { conversationService } from "./conversationService.js";
import { subscriptionService } from "./subscriptionService.js";
import { prisma } from "../lib/prisma.js";

export const messageService = {
  // ─── Public (session-based) ───────────────────────────────────────────

  async createPublic(data: {
    prompt: string;
    threadId: string;
    contactSessionId: string;
  }) {
    const contactSession = await contactSessionService.getOne(
      data.contactSessionId,
    );

    if (!contactSession || contactSession.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid session");
    }

    const conversation = await conversationService.getByThreadId(data.threadId);

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    if (conversation.status === "resolved") {
      throw new BadRequestError("Conversation resolved");
    }

    // Refresh session
    await contactSessionService.refresh(data.contactSessionId);

    const subscription = await subscriptionService.getByOrganizationId(
      conversation.organizationId,
    );

    const shouldTriggerAgent =
      conversation.status === "unresolved" && subscription?.status === "active";

    if (shouldTriggerAgent) {
      await runSupportAgent(data.threadId, data.prompt);
    } else {
      // Just save the user message without triggering AI
      await agentService.saveMessage(data.threadId, {
        role: "user",
        content: data.prompt,
      });
    }
  },

  async getManyPublic(data: {
    threadId: string;
    contactSessionId: string;
    cursor?: string;
    limit?: number;
  }) {
    const contactSession = await contactSessionService.getOne(
      data.contactSessionId,
    );

    if (!contactSession || contactSession.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid session");
    }

    return await agentService.listMessages(data.threadId, {
      cursor: data.cursor,
      limit: data.limit,
    });
  },

  // ─── Private (auth-required) ──────────────────────────────────────────

  async enhanceResponse(prompt: string, orgId: string) {
    const subscription = await subscriptionService.getByOrganizationId(orgId);

    if (subscription?.status !== "active") {
      throw new BadRequestError("Missing subscription");
    }

    const response = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [
        {
          role: "system",
          content: OPERATOR_MESSAGE_ENHANCEMENT_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return response.text;
  },

  async createPrivate(data: {
    prompt: string;
    conversationId: string;
    orgId: string;
    operatorName?: string;
  }) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    if (conversation.organizationId !== data.orgId) {
      throw new UnauthorizedError("Invalid Organization ID");
    }

    if (conversation.status === "resolved") {
      throw new BadRequestError("Conversation resolved");
    }

    if (conversation.status === "unresolved") {
      await prisma.conversation.update({
        where: { id: data.conversationId },
        data: { status: "escalated" },
      });
    }

    await agentService.saveMessage(conversation.threadId, {
      role: "assistant",
      content: data.prompt,
      agentName: data.operatorName,
    });
  },

  async getManyPrivate(data: {
    threadId: string;
    orgId: string;
    cursor?: string;
    limit?: number;
  }) {
    const conversation = await prisma.conversation.findFirst({
      where: { threadId: data.threadId },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    if (conversation.organizationId !== data.orgId) {
      throw new UnauthorizedError("Invalid Organization ID");
    }

    return await agentService.listMessages(data.threadId, {
      cursor: data.cursor,
      limit: data.limit,
    });
  },
};
