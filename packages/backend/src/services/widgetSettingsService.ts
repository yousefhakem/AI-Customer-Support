import { prisma } from "../lib/prisma.js";
import type { DefaultSuggestions, VapiSettings } from "../types/index.js";

export const widgetSettingsService = {
  async getByOrganizationId(organizationId: string) {
    return await prisma.widgetSettings.findUnique({
      where: { organizationId },
    });
  },

  async upsert(
    orgId: string,
    data: {
      greetMessage: string;
      defaultSuggestions: DefaultSuggestions;
      vapiSettings: VapiSettings;
    },
  ) {
    await prisma.widgetSettings.upsert({
      where: { organizationId: orgId },
      update: {
        greetMessage: data.greetMessage,
        defaultSuggestions: data.defaultSuggestions as object,
        vapiSettings: data.vapiSettings as object,
      },
      create: {
        organizationId: orgId,
        greetMessage: data.greetMessage,
        defaultSuggestions: data.defaultSuggestions as object,
        vapiSettings: data.vapiSettings as object,
      },
    });
  },

  async getOne(orgId: string) {
    return await prisma.widgetSettings.findUnique({
      where: { organizationId: orgId },
    });
  },
};
