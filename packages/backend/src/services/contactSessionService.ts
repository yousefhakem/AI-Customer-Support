import { prisma } from "../lib/prisma.js";
import { NotFoundError, BadRequestError } from "../lib/errors.js";
import type { ContactSessionMetadata } from "../types/index.js";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const AUTO_REFRESH_THRESHOLD_MS = 4 * 60 * 60 * 1000;

export const contactSessionService = {
  async create(data: {
    name: string;
    email: string;
    organizationId: string;
    metadata?: ContactSessionMetadata;
  }) {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    const contactSession = await prisma.contactSession.create({
      data: {
        name: data.name,
        email: data.email,
        organizationId: data.organizationId,
        expiresAt,
        metadata: data.metadata ? (data.metadata as object) : undefined,
      },
    });

    return contactSession;
  },

  async validate(contactSessionId: string) {
    const contactSession = await prisma.contactSession.findUnique({
      where: { id: contactSessionId },
    });

    if (!contactSession) {
      return { valid: false as const, reason: "Contact session not found" };
    }

    if (contactSession.expiresAt < new Date()) {
      return { valid: false as const, reason: "Contact session expired" };
    }

    return { valid: true as const, contactSession };
  },

  async refresh(contactSessionId: string) {
    const contactSession = await prisma.contactSession.findUnique({
      where: { id: contactSessionId },
    });

    if (!contactSession) {
      throw new NotFoundError("Contact session not found");
    }

    if (contactSession.expiresAt < new Date()) {
      throw new BadRequestError("Contact session expired");
    }

    const timeRemaining = contactSession.expiresAt.getTime() - Date.now();

    if (timeRemaining < AUTO_REFRESH_THRESHOLD_MS) {
      const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);

      const updated = await prisma.contactSession.update({
        where: { id: contactSessionId },
        data: { expiresAt: newExpiresAt },
      });

      return updated;
    }

    return contactSession;
  },

  async getOne(contactSessionId: string) {
    return await prisma.contactSession.findUnique({
      where: { id: contactSessionId },
    });
  },

  async getOneByConversationId(conversationId: string, orgId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contactSession: true },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    if (conversation.organizationId !== orgId) {
      throw new NotFoundError("Invalid organization id");
    }

    return conversation.contactSession;
  },
};
