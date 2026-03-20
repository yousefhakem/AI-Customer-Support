import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";

export const pluginService = {
  async upsert(data: {
    organizationId: string;
    service: string;
    secretName: string;
  }) {
    await prisma.plugin.upsert({
      where: {
        organizationId_service: {
          organizationId: data.organizationId,
          service: data.service,
        },
      },
      update: {
        service: data.service,
        secretName: data.secretName,
      },
      create: {
        organizationId: data.organizationId,
        service: data.service,
        secretName: data.secretName,
      },
    });
  },

  async getByOrganizationIdAndService(organizationId: string, service: string) {
    return await prisma.plugin.findUnique({
      where: {
        organizationId_service: {
          organizationId,
          service,
        },
      },
    });
  },

  async getOne(orgId: string, service: string) {
    return await prisma.plugin.findUnique({
      where: {
        organizationId_service: {
          organizationId: orgId,
          service,
        },
      },
    });
  },

  async remove(orgId: string, service: string) {
    const existingPlugin = await prisma.plugin.findUnique({
      where: {
        organizationId_service: {
          organizationId: orgId,
          service,
        },
      },
    });

    if (!existingPlugin) {
      throw new NotFoundError("Plugin not found");
    }

    await prisma.plugin.delete({
      where: { id: existingPlugin.id },
    });
  },
};
