import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { clerkAuth } from "./middleware/auth.js";

// ─── Public Routes ──────────────────────────────────────────────────────────
import publicContactSessions from "./routes/public/contactSessions.js";
import publicConversations from "./routes/public/conversations.js";
import publicMessages from "./routes/public/messages.js";
import publicOrganizations from "./routes/public/organizations.js";
import publicSecrets from "./routes/public/secrets.js";
import publicWidgetSettings from "./routes/public/widgetSettings.js";

// ─── Private Routes ─────────────────────────────────────────────────────────
import privateContactSessions from "./routes/private/contactSessions.js";
import privateConversations from "./routes/private/conversations.js";
import privateMessages from "./routes/private/messages.js";
import privateFiles from "./routes/private/files.js";
import privatePlugins from "./routes/private/plugins.js";
import privateSecrets from "./routes/private/secrets.js";
import privateVapi from "./routes/private/vapi.js";
import privateWidgetSettings from "./routes/private/widgetSettings.js";

// ─── Webhooks ───────────────────────────────────────────────────────────────
import clerkWebhook from "./routes/webhooks/clerk.js";

const app = express();

// ─── Global Middleware ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: [env.WEB_APP_URL, env.WIDGET_APP_URL],
    credentials: true,
  }),
);
app.use(express.json({ limit: "50mb" }));

// ─── Health Check ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Public API Routes (no auth required) ───────────────────────────────────
app.use("/api/public/contact-sessions", publicContactSessions);
app.use("/api/public/conversations", publicConversations);
app.use("/api/public/messages", publicMessages);
app.use("/api/public/organizations", publicOrganizations);
app.use("/api/public/secrets", publicSecrets);
app.use("/api/public/widget-settings", publicWidgetSettings);

// ─── Private API Routes (Clerk auth required) ──────────────────────────────
app.use("/api/private/contact-sessions", clerkAuth, privateContactSessions);
app.use("/api/private/conversations", clerkAuth, privateConversations);
app.use("/api/private/messages", clerkAuth, privateMessages);
app.use("/api/private/files", clerkAuth, privateFiles);
app.use("/api/private/plugins", clerkAuth, privatePlugins);
app.use("/api/private/secrets", clerkAuth, privateSecrets);
app.use("/api/private/vapi", clerkAuth, privateVapi);
app.use("/api/private/widget-settings", clerkAuth, privateWidgetSettings);

// ─── Webhook Routes ─────────────────────────────────────────────────────────
app.use("/api/webhooks/clerk", clerkWebhook);

// ─── Error Handling ─────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`);
  console.log(`📋 Health check: http://localhost:${env.PORT}/health`);
});

export default app;
