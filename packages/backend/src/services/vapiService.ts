import { VapiClient, Vapi } from "@vapi-ai/server-sdk";
import { NotFoundError } from "../lib/errors.js";
import { getSecretValue, parseSecretString } from "../lib/secrets.js";
import { pluginService } from "./pluginService.js";

interface VapiSecrets {
  privateApiKey: string;
  publicApiKey: string;
}

async function getVapiClient(orgId: string): Promise<VapiClient> {
  const plugin = await pluginService.getByOrganizationIdAndService(orgId, "vapi");

  if (!plugin) {
    throw new NotFoundError("Plugin not found");
  }

  const secretValue = await getSecretValue(plugin.secretName);
  const secretData = parseSecretString<VapiSecrets>(secretValue);

  if (!secretData) {
    throw new NotFoundError("Credentials not found");
  }

  if (!secretData.privateApiKey || !secretData.publicApiKey) {
    throw new NotFoundError(
      "Credentials incomplete. Please reconnect your Vapi account.",
    );
  }

  return new VapiClient({ token: secretData.privateApiKey });
}

export const vapiService = {
  async getAssistants(orgId: string): Promise<Vapi.Assistant[]> {
    const client = await getVapiClient(orgId);
    return await client.assistants.list();
  },

  async getPhoneNumbers(orgId: string): Promise<Vapi.PhoneNumbersListResponseItem[]> {
    const client = await getVapiClient(orgId);
    return await client.phoneNumbers.list();
  },

  async getPublicKey(organizationId: string): Promise<string | null> {
    const plugin = await pluginService.getByOrganizationIdAndService(
      organizationId,
      "vapi",
    );

    if (!plugin) {
      return null;
    }

    const secret = await getSecretValue(plugin.secretName);
    const secretData = parseSecretString<VapiSecrets>(secret);

    if (!secretData?.publicApiKey || !secretData?.privateApiKey) {
      return null;
    }

    return secretData.publicApiKey;
  },
};
