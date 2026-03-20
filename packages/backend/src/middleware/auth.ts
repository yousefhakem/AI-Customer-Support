import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { env } from "../config/env.js";
import { UnauthorizedError } from "../lib/errors.js";

// Augment Express Request type to include auth
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        orgId: string;
      };
    }
  }
}

/**
 * Middleware that verifies Clerk JWT tokens from the Authorization header.
 * Extracts userId and orgId from the token claims.
 * Used for all "private" routes (dashboard / operator-facing).
 */
export async function clerkAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid Authorization header");
    }

    const token = authHeader.slice(7);

    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    const userId = payload.sub;
    const orgId = (payload as Record<string, unknown>).org_id as string | undefined;

    if (!userId) {
      throw new UnauthorizedError("Identity not found");
    }

    if (!orgId) {
      throw new UnauthorizedError("Organization not found");
    }

    req.auth = {
      userId,
      orgId,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    next(new UnauthorizedError("Invalid token"));
  }
}
