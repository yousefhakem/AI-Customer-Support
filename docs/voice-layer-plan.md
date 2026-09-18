# Voice Layer Plan

Replace the bring-your-own-Vapi voice feature with a built-in voice agent that uses the same knowledge base, tools, and inbox as text chat. Build it so the model provider is a setting (OpenAI Realtime or Gemini Live), compare the two, then roll out the winner. Vapi keeps working until the new path has proven itself.

## Goals
- **One agent:** voice uses the same support prompt, knowledge-base search, and escalate/resolve tools as text chat.
- **Calls are saved:** voice transcripts land in the conversation thread and show up live in the dashboard inbox.
- **Zero setup for customers:** no Vapi account or keys; voice is a toggle on the Customization page.
- **Swappable provider:** OpenAI `gpt-realtime-2.1-mini` and Gemini Live behind one interface, chosen per org.
- **Cost is bounded:** only orgs with an active subscription, with a per-call length cap and a monthly minute quota.

## Non-goals (for now)
- Phone numbers / inbound calls. Browser voice first; phone (OpenAI SIP or Twilio) is a later phase.
- Removing Vapi. That happens only after the new path has run in production.

---

## How it works today (for reference)

| Piece | File |
|---|---|
| Voice hook (Vapi Web SDK, transcript in React state only) | `apps/widget/modules/widget/hooks/use-vapi.ts` |
| Voice UI | `apps/widget/modules/widget/ui/screens/widget-voice-screen.tsx` |
| Loads the org's Vapi public key on startup | `apps/widget/modules/widget/ui/screens/widget-loading-screen.tsx` (step `"vapi"`) |
| Shows the voice/phone buttons | `apps/widget/modules/widget/ui/screens/widget-selection-screen.tsx` |
| Vapi keys in AWS Secrets Manager | `packages/backend/convex/system/secrets.ts`, `public/secrets.ts`, `private/vapi.ts` |
| Per-org Vapi assistant + phone number | `widgetSettings.vapiSettings` in `schema.ts` |
| Text agent + tools | `system/ai/agents/supportAgent.ts`, `system/ai/tools/*.ts`, `public/messages.ts` |

The text agent only runs when the org's subscription is `active` (`public/messages.ts`). Voice follows the same rule.

---

## Architecture

```
Widget (browser)                         Convex                           Provider
─────────────────                        ──────                           ────────
useVoice() ── startCall ───────────────▶ public.voice.startCall
                                           validate session + sub + quota
                                           create conversation (channel: voice)
                                           insert voiceCalls row
                                           mint short-lived token ───────▶ OpenAI client_secrets
                                         ◀─ { callId, provider, token, config }   / Gemini authTokens
adapter.connect(token) ─────────────────────────────────────────────────▶ WebRTC / WebSocket audio
   on tool call ──────────────────────▶ public.voice.runTool ─▶ knowledge-base search / escalate / resolve
   ◀── result ── send back to model
   on final transcript ───────────────▶ public.voice.appendTranscript ─▶ saveMessage(thread)
                                                                            └─▶ dashboard inbox updates live
endCall ───────────────────────────────▶ public.voice.endCall (duration → quota)
```

**Why the browser relays tool calls and transcripts:** the audio connection runs browser ↔ provider. Having Convex hold the connection instead ("server-side sideband") needs a long-lived process, which Convex actions and Vercel functions can't run. The browser relaying to Convex is simple and fits the stack. The tradeoff is under *Security*.

### Provider differences the adapters hide

| | OpenAI Realtime | Gemini Live |
|---|---|---|
| Server mints | `POST /v1/realtime/client_secrets` with the session config (model, voice, instructions, tools, transcription). Returns an `ek_...` key. | `ai.authTokens.create()` in `@google/genai`, `uses: 1`, with `liveConnectConstraints` locking model and config. |
| Browser connects | WebRTC: POST an SDP offer to `https://api.openai.com/v1/realtime/calls` with `Bearer ek_...`; events on the `oai-events` data channel. | WebSocket via `ai.live.connect()` with the token as the API key (v1beta). |
| Audio I/O | Handled by WebRTC (mic, echo cancellation, playback). | **Manual:** capture 16 kHz PCM with an AudioWorklet and play back 24 kHz PCM. Noticeably more client code. |
| Tool calls | Function-call events on the data channel; reply with a `function_call_output` item. | `toolCall` messages; reply with `sendToolResponse`. |
| Transcripts | Input transcription must be enabled in the session config (billed separately, ~$0.003/min with `gpt-4o-mini-transcribe`); output transcript arrives with the audio. | Enable `inputAudioTranscription` / `outputAudioTranscription` in the config. |

Check the exact event names against the current API reference while implementing. Both APIs changed names between beta and GA.

---

## Backend changes (`packages/backend/convex`)

### Schema (`schema.ts`)
```ts
widgetSettings: {
  ...,
  vapiSettings: ...,                      // unchanged
  voiceSettings: v.optional(v.object({
    enabled: v.boolean(),
    provider: v.union(v.literal("openai"), v.literal("gemini")),
    voice: v.optional(v.string()),        // provider voice name
  })),
}

conversations: {
  ...,
  channel: v.optional(v.union(v.literal("chat"), v.literal("voice"))), // missing = chat
}

voiceCalls: defineTable({
  organizationId: v.string(),
  conversationId: v.id("conversations"),
  contactSessionId: v.id("contactSessions"),
  provider: v.union(v.literal("openai"), v.literal("gemini")),
  model: v.string(),
  status: v.union(v.literal("active"), v.literal("ended")),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  durationSeconds: v.optional(v.number()),
})
  .index("by_organization_id_and_started_at", ["organizationId", "startedAt"])
  .index("by_status_and_started_at", ["status", "startedAt"]),
```
Every new field is optional, so no data migration is needed.

### Shared agent logic
- **`system/ai/knowledgeBase.ts`** (new): `searchKnowledgeBase(ctx, organizationId, query)` holds the `rag.search` call now inside `tools/search.ts`. The text `search` tool calls it and keeps its current behaviour (interpreter pass + saving a message).
  For voice, return the raw search text **without** the extra `gpt-4o-mini` interpreter call. The realtime model can summarise it itself, and skipping the call saves roughly a second of silence per lookup.
- **`system/ai/voice/instructions.ts`** (new): `SUPPORT_AGENT_PROMPT` plus voice rules: short spoken sentences, no markdown or lists, confirm before escalating, say "one moment" before searching.
- **`system/ai/voice/tools.ts`** (new): the three tools as JSON-schema definitions (search, escalate, resolve), shared by both providers, plus `executeVoiceTool(ctx, call, name, args)`. Escalate/resolve call the existing `internal.system.conversations.escalate` / `resolve`.
- **`system/ai/voice/providers/openai.ts`, `gemini.ts`** (new, `"use node"`): `mintSession({ instructions, tools, voice }) → { token, model, expiresAt, clientConfig }`. Model names live here as constants (`gpt-realtime-2.1-mini`, the current Gemini Live model).

### Public API (`public/voice.ts`, new)
All functions take `contactSessionId` and reject expired sessions, exactly like `public/messages.ts`.

| Function | Type | Does |
|---|---|---|
| `startCall({ organizationId, contactSessionId, conversationId? })` | action | Checks: voice enabled for the org, subscription `active`, monthly minutes under quota, no other `active` call for this contact session, and a basic rate limit. Creates a `channel: "voice"` conversation if none was given. Inserts a `voiceCalls` row, mints the provider token, and returns `{ callId, conversationId, threadId, provider, token, clientConfig, maxDurationSeconds }`. |
| `runTool({ callId, contactSessionId, name, args })` | action | Checks the call is `active` and belongs to the session, validates `args` with zod, and runs `executeVoiceTool`. Returns a string for the model. |
| `appendTranscript({ callId, contactSessionId, role, text })` | mutation | Checks the call is active and the text length is bounded, then saves to the thread (`saveMessage`). `role` = `user` or `assistant`. |
| `endCall({ callId, contactSessionId })` | mutation | Marks the call ended and stores the duration. Idempotent. |

### Backstops
- **Cron** (`crons.ts`, new): every 5 minutes, end `active` calls older than `maxDurationSeconds + 60s`. This covers browsers that close without calling `endCall`.
- **Quota:** a monthly-minutes limit per org (e.g. a constant per plan to start), summed from `voiceCalls` since the start of the month.

### Private API (`private/widgetSettings.ts`)
Accept `voiceSettings` in the existing upsert.

### Env
- OpenAI: the existing `OPENAI_API_KEY`.
- Gemini (only while testing it): `GOOGLE_GENERATIVE_AI_API_KEY` via `npx convex env set`.

---

## Widget changes (`apps/widget/modules/widget`)

```
hooks/
  use-voice.ts              # replaces use-vapi.ts; same return shape
  voice/
    types.ts                # VoiceAdapter interface
    openai-webrtc.ts
    gemini-live.ts
    pcm-worklet.ts          # Gemini only: mic capture + playback
    vapi.ts                 # existing Vapi logic moved behind the interface
```

```ts
// types.ts
export interface VoiceAdapter {
  connect(session: VoiceSession, events: VoiceEvents): Promise<void>;
  disconnect(): void;
}
export interface VoiceEvents {
  onStatus(status: "connecting" | "connected" | "ended" | "error"): void;
  onSpeaking(isSpeaking: boolean): void;
  onTranscript(entry: { role: "user" | "assistant"; text: string }): void; // final only
  onToolCall(call: { name: string; args: unknown }): Promise<string>;
}
```

`useVoice()` picks the adapter from `widgetSettings.voiceSettings.provider` (or `vapi` when only the old setup exists). It wires `onToolCall` to `public.voice.runTool` and `onTranscript` to `public.voice.appendTranscript`, and enforces `maxDurationSeconds` with a timer. It returns `{ isSpeaking, isConnecting, isConnected, transcript, startCall, endCall }`, the same as `useVapi`, so `widget-voice-screen.tsx` only changes its import.

Other widget edits:
- **Loading screen:** only fetch Vapi secrets when the org is on Vapi.
- **Selection screen:** show "Start voice call" when `voiceSettings.enabled` **or** the existing Vapi condition holds. The phone button stays Vapi-only.
- **Voice screen:** after a call ends, offer "Continue in chat", which opens the same conversation in the chat screen, since the transcript is now in that thread.
- The embed iframe already has `allow="microphone"` (`apps/embed/embed.ts`), so nothing to change there.

## Dashboard changes (`apps/web`)
- **Customization page:** a "Voice agent" section with an enable toggle, provider select (visible while testing; later hidden or admin-only), and voice select. It sits next to the existing Vapi fields.
- **Inbox / conversation view:** a small mic badge on `channel: "voice"` conversations.
- **Plugins page:** unchanged in phases 1–4. Later, label Vapi "legacy".

---

## Security
- **Tokens:** short-lived (OpenAI's expire after about a minute unless used; Gemini's are `uses: 1`), minted only after the session, subscription, and quota checks. The real API keys never reach the browser.
- **Transcripts come from the browser**, so a customer could write fake text into **their own** conversation. That's the same trust level as text chat, where the customer already sends arbitrary messages. Mitigations: bound the length, only accept writes while a call is `active`, and tag voice messages so the dashboard can show where they came from. If this ever matters, the fix is server-side sideband, which needs a long-running worker.
- **Tool calls come from the browser:** `runTool` re-checks the call and session ownership and only exposes search/escalate/resolve, which is the same power a customer already has in text chat.
- **Abuse:** one active call per contact session, a rate limit on `startCall`, a per-call length cap, and a per-org monthly quota.

## Cost controls
- Voice requires `subscription.status === "active"`, the same gate as the text agent.
- Default max call length: 10 minutes. The client hangs up and the cron cleans up.
- The monthly quota per org is enforced in `startCall`. Show usage on the Billing page later.
- Log the model and duration per call in `voiceCalls` so the provider comparison uses real numbers.

---

## Phases
Each phase ships on its own and leaves the app working.

| # | Phase | Ships | User-visible change |
|---|---|---|---|
| 1 | **Refactor (no behaviour change)** | `use-voice.ts` + `voice/vapi.ts` adapter; `searchKnowledgeBase` extracted and used by the text search tool | None: Vapi works exactly as before |
| 2 | **Backend voice sessions + OpenAI adapter** | Schema additions, `public/voice.ts`, providers/openai, `openai-webrtc.ts`, transcript saving, cron | Only for orgs where you set `voiceSettings` manually in the Convex dashboard (your test org) |
| 3 | **Gemini adapter** | providers/gemini, `gemini-live.ts`, PCM worklet | Same: test org only |
| 4 | **Comparison test** | 10 scripted scenarios per provider (see below) | None |
| 5 | **Dashboard + rollout** | Customization toggle, inbox badge, quotas on Billing; default provider = the winner | Voice available to `pro` orgs with no setup |
| 6 | **Vapi retirement** | Hide Vapi for new orgs; after existing orgs move over, remove Vapi code, `@vapi-ai/*`, and AWS Secrets Manager (it only stores Vapi keys) | Plugins page drops Vapi |
| 7 | *(later)* **Phone** | OpenAI SIP or Twilio → the same tools/transcripts path | Phone numbers without Vapi |

### Phase 4: comparison scenarios
Run each on both providers against a test knowledge base with ~10 documents:
1. A simple FAQ answered from the knowledge base
2. A question needing two facts from different documents
3. A question the knowledge base can't answer (it should say so, not invent an answer)
4. The customer interrupts mid-answer
5. "I want to talk to a human" (it must call escalate)
6. "Thanks, that solved it" (it should call resolve)
7. A strong accent / non-native speaker
8. Background noise (café audio)
9. Spelling out an email address or order number
10. A 5-minute rambling call (context growth → cost per minute)

Score each: accuracy (0–2), correct tool call (y/n), delay before first reply, naturalness (0–2). Record **actual** cost from each provider's usage dashboard. Pick the cheaper provider unless it loses on accuracy or escalation. Those matter more than voice quality for support.

---

## Open questions
1. **Quota numbers:** how many voice minutes per month does `pro` include? (Needs a price decision; the table in the chat estimate was ~$0.02–0.04/min for mini/Gemini.)
2. **Free plan:** no voice, or a small trial allowance?
3. **Voice + text in one conversation:** keep one thread (proposed), or separate voice conversations?
4. **Recording audio:** not planned (transcripts only). Some customers may ask for it, which has storage and privacy implications.
5. **Consent notice:** show "This call is transcribed" before connecting. Proposed yes; may be legally required in some regions.
