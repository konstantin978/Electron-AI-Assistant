import { randomUUID } from "node:crypto";
import { simpleCompletion, type Message as LlmMessage } from "../llm.js";
import { addMemory } from "../db/memories.js";
import type { ChatMessage, Memory } from "../db/types.js";
import { log } from "../utils/logger.js";

const SUMMARY_SYSTEM = `You compress conversations into terse summaries.
Read the messages and produce a single paragraph (3-5 sentences) that captures:
- What the user asked about
- Key facts established
- Important results or decisions

Plain text only. No bullet points. No preamble like "Summary:". Just the paragraph.`;

const MEMORY_EXTRACT_SYSTEM = `You extract DURABLE personal facts about the user from a conversation.

Return a JSON array of short strings (≤80 chars each). Examples of facts worth keeping:
- "User's name is Konstantin"
- "User lives in Yerevan"
- "User works at Picsart as a software engineer"
- "User is learning AI and prefers writing code himself"
- "User uses an Apple Silicon Mac with 32GB RAM"

Do NOT keep:
- One-off questions or commands
- Tool results (file contents, timestamps, etc.)
- Transient context that won't matter tomorrow

If nothing durable was said, return [].

Output: ONLY valid JSON array, nothing else. No code fences, no commentary.`;

const renderForLlm = (m: ChatMessage): string => {
  if (m.role === "tool") return "";
  const speaker = m.role === "user" ? "User" : "Assistant";
  return `${speaker}: ${m.content}`;
};

export const summarizeMessages = async (
  messages: ChatMessage[],
): Promise<string> => {
  const transcript = messages
    .map(renderForLlm)
    .filter((line) => line.length > 0)
    .join("\n");
  if (!transcript.trim()) return "";

  const llmMessages: LlmMessage[] = [
    { role: "system", content: SUMMARY_SYSTEM },
    { role: "user", content: transcript },
  ];
  try {
    const summary = await simpleCompletion(llmMessages, 0.2);
    return summary.trim();
  } catch (err) {
    log.error(`summarize failed: ${(err as Error).message}`);
    return "";
  }
};

const tryParseJsonArray = (raw: string): string[] | null => {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (
      Array.isArray(parsed) &&
      parsed.every((x) => typeof x === "string" && x.length > 0)
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
};

/**
 * Asynchronously extract durable user facts from a chat turn and save them.
 * Fire-and-forget — does not block the main reply flow.
 */
export const extractAndSaveMemories = async (
  chatId: string,
  recentMessages: ChatMessage[],
): Promise<void> => {
  const transcript = recentMessages
    .map(renderForLlm)
    .filter((line) => line.length > 0)
    .join("\n");
  if (!transcript.trim()) return;

  const llmMessages: LlmMessage[] = [
    { role: "system", content: MEMORY_EXTRACT_SYSTEM },
    { role: "user", content: transcript },
  ];

  try {
    const raw = await simpleCompletion(llmMessages, 0.1);
    const facts = tryParseJsonArray(raw);
    if (!facts || facts.length === 0) return;

    log.info(`[memory] extracted ${facts.length} fact(s) from chat ${chatId}`);

    const now = Date.now();
    for (const fact of facts) {
      const memory: Memory = {
        id: randomUUID(),
        fact: fact.slice(0, 200),
        sourceChatId: chatId,
        createdAt: now,
      };
      await addMemory(memory);
    }
  } catch (err) {
    log.error(`memory extract failed: ${(err as Error).message}`);
  }
};
