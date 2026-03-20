// ─── Shared TypeScript Interfaces ─────────────────────────────────────────

/** Contact session metadata (browser info) */
export interface ContactSessionMetadata {
  userAgent?: string;
  language?: string;
  languages?: string;
  platform?: string;
  vendor?: string;
  screenResolution?: string;
  viewportSize?: string;
  timezone?: string;
  timezoneOffset?: number;
  cookieEnabled?: boolean;
  referrer?: string;
  currentUrl?: string;
}

/** Widget default suggestions */
export interface DefaultSuggestions {
  suggestion1?: string;
  suggestion2?: string;
  suggestion3?: string;
}

/** Vapi settings for widget */
export interface VapiSettings {
  assistantId?: string;
  phoneNumber?: string;
}

/** Conversation status enum */
export type ConversationStatus = "unresolved" | "escalated" | "resolved";

/** Message role enum */
export type MessageRole = "user" | "assistant" | "system";

/** RAG entry metadata */
export interface RagEntryMetadata {
  s3Key: string;
  uploadedBy: string;
  filename: string;
  category: string | null;
}

/** Public file shape returned by list endpoint */
export interface PublicFile {
  id: string;
  name: string;
  type: string;
  size: string;
  status: "ready" | "processing" | "error";
  url: string | null;
  category?: string;
}

/** Pagination params for cursor-based pagination */
export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  page: T[];
  nextCursor: string | null;
  isDone: boolean;
}
