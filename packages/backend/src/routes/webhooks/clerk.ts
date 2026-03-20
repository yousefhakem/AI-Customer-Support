import { Router } from "express";
import { Webhook } from "svix";
import { createClerkClient } from "@clerk/backend";
import type { WebhookEvent } from "@clerk/backend";
import { env } from "../../config/env.js";
import { subscriptionService } from "../../services/subscriptionService.js";

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
});

const router = Router();

// POST /api/webhooks/clerk
router.post("/", async (req, res, next) => {
  try {
    const event = await validateRequest(req);

    if (!event) {
      res.status(400).json({ error: "Invalid webhook" });
      return;
    }

    switch (event.type) {
      case "subscription.updated": {
        const subscription = event.data as {
          status: string;
          payer?: {
            organization_id: string;
          };
        };

        const organizationId = subscription.payer?.organization_id;

        if (!organizationId) {
          res.status(400).json({ error: "Missing Organization ID" });
          return;
        }

        const newMaxAllowedMemberships =
          subscription.status === "active" ? 5 : 1;

        await clerkClient.organizations.updateOrganization(organizationId, {
          maxAllowedMemberships: newMaxAllowedMemberships,
        });

        await subscriptionService.upsert(organizationId, subscription.status);

        break;
      }
      default:
        console.log("Ignored Clerk webhook event", event.type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

async function validateRequest(
  req: { body: unknown; headers: Record<string, string | string[] | undefined> },
): Promise<WebhookEvent | null> {
  // For webhook validation, we need the raw body as a string
  const payloadString =
    typeof req.body === "string" ? req.body : JSON.stringify(req.body);

  const svixHeaders = {
    "svix-id": (req.headers["svix-id"] as string) || "",
    "svix-timestamp": (req.headers["svix-timestamp"] as string) || "",
    "svix-signature": (req.headers["svix-signature"] as string) || "",
  };

  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);

  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook event", error);
    return null;
  }
}

export default router;
