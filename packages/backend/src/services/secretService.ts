import { upsertSecret } from "../lib/secrets.js";
import { pluginService } from "./pluginService.js";

export const secretService = {
  async upsert(data: {
    organizationId: string;
    service: "vapi";
    value: Record<string, unknown>;
  }) {
    const secretName = `tenant/${data.organizationId}/${data.service}`;

    await upsertSecret(secretName, data.value);

    await pluginService.upsert({
      service: data.service,
      secretName,
      organizationId: data.organizationId,
    });

    return { status: "success" };
  },
};
