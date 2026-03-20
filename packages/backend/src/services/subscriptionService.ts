import { prisma } from "../lib/prisma.js";

export const subscriptionService = {
  async upsert(organizationId: string, status: string) {
    await prisma.subscription.upsert({
      where: { organizationId },
      update: { status },
      create: { organizationId, status },
    });
  },

  async getByOrganizationId(organizationId: string) {
    return await prisma.subscription.findUnique({
      where: { organizationId },
    });
  },
};
