import { createClerkClient } from "@clerk/backend";
import { env } from "../config/env.js";

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
});

export const organizationService = {
  async validate(organizationId: string) {
    try {
      const organization = await clerkClient.organizations.getOrganization({
        organizationId,
      });

      if (organization) {
        return { valid: true };
      }
      return { valid: false, reason: "Organization not valid" };
    } catch {
      return { valid: false, reason: "Organization not valid" };
    }
  },
};
