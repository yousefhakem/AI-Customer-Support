import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";
import { agentService } from "./agent.js";
import { ragService } from "./rag.js";
import { conversationService } from "../services/conversationService.js";
import {
  SUPPORT_AGENT_PROMPT,
  SEARCH_INTERPRETER_PROMPT,
} from "./constants.js";

/**
 * AI tools that the support agent can invoke during conversation.
 * Replaces @convex-dev/agent createTool() with ai SDK tool().
 */

function createEscalateConversationTool(threadId: string) {
  return tool({
    description: "Escalate a conversation",
    parameters: z.object({}),
    execute: async () => {
      if (!threadId) return "Missing thread ID";

      await conversationService.escalateByThreadId(threadId);

      await agentService.saveMessage(threadId, {
        role: "assistant",
        content: "Conversation escalated to a human operator.",
      });

      return "Conversation escalated to a human operator";
    },
  });
}

function createResolveConversationTool(threadId: string) {
  return tool({
    description: "Resolve a conversation",
    parameters: z.object({}),
    execute: async () => {
      if (!threadId) return "Missing thread ID";

      await conversationService.resolveByThreadId(threadId);

      await agentService.saveMessage(threadId, {
        role: "assistant",
        content: "Conversation resolved.",
      });

      return "Conversation resolved";
    },
  });
}

function createSearchTool(threadId: string) {
  return tool({
    description:
      "Search the knowledge base for relevant information to help answer user questions",
    parameters: z.object({
      query: z
        .string()
        .describe("The search query to find relevant information"),
    }),
    execute: async ({ query }) => {
      if (!threadId) return "Missing thread ID";

      const conversation = await conversationService.getByThreadId(threadId);

      if (!conversation) return "Conversation not found";

      const orgId = conversation.organizationId;

      const searchResult = await ragService.search(orgId, query, 5);

      const contextText = `Found results in ${searchResult.entries
        .map((e) => e.title || null)
        .filter((t) => t !== null)
        .join(", ")}. Here is the context:\n\n${searchResult.text}`;

      const response = await generateText({
        messages: [
          {
            role: "system",
            content: SEARCH_INTERPRETER_PROMPT,
          },
          {
            role: "user",
            content: `User asked: "${query}"\n\nSearch results: ${contextText}`,
          },
        ],
        model: openai.chat("gpt-4o-mini"),
      });

      await agentService.saveMessage(threadId, {
        role: "assistant",
        content: response.text,
      });

      return response.text;
    },
  });
}

/**
 * Run the support agent to generate a response for a user message.
 */
export async function runSupportAgent(
  threadId: string,
  prompt: string,
): Promise<void> {
  // Get conversation history for context
  const messages = await agentService.getAllMessages(threadId);

  // Save user message first
  await agentService.saveMessage(threadId, {
    role: "user",
    content: prompt,
  });

  const aiMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  // Add the new user message
  aiMessages.push({ role: "user", content: prompt });

  const result = await generateText({
    model: openai.chat("gpt-4o-mini"),
    system: SUPPORT_AGENT_PROMPT,
    messages: aiMessages,
    tools: {
      escalateConversationTool: createEscalateConversationTool(threadId),
      resolveConversationTool: createResolveConversationTool(threadId),
      searchTool: createSearchTool(threadId),
    },
    maxSteps: 5,
  });

  // Save the final assistant response (if tools didn't already save one)
  if (result.text) {
    await agentService.saveMessage(threadId, {
      role: "assistant",
      content: result.text,
    });
  }
}
