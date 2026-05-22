import { randomUUID } from "node:crypto";
import {
  call,
  type Message as LlmMessage,
  type OnChunk,
} from "../llm.js";
import { SYSTEM_PROMPT } from "../config.js";
import { getChat, appendMessage } from "../db/chats.js";
import { listMemories } from "../db/memories.js";
import {
  summarizeMessages,
  extractAndSaveMemories,
} from "./summarize.js";
import { StreamingSpeaker } from "./speech-queue.js";
import type { ChatMessage, ToolCallRecord } from "../db/types.js";
import { log } from "../utils/logger.js";

// Compress history when chat grows past this many messages.
// Keep the most recent KEEP_RECENT; summarize everything older.
const COMPRESS_THRESHOLD = 20;
const KEEP_RECENT = 10;

// How many cross-chat memories to inject into context per request.
const MEMORIES_IN_CONTEXT = 10;

const dbToLlm = (m: ChatMessage): LlmMessage => {
  const msg: LlmMessage = { role: m.role, content: m.content };
  if (m.toolCalls && m.toolCalls.length > 0) {
    msg.tool_calls = m.toolCalls.map((tc) => ({
      function: {
        name: tc.name,
        arguments: tc.args ?? {},
      },
    }));
  }
  return msg;
};

const llmToDb = (m: LlmMessage): ChatMessage => {
  const toolCalls: ToolCallRecord[] | undefined = m.tool_calls?.map((tc) => ({
    name: tc.function.name,
    args: tc.function.arguments,
  }));
  return {
    id: randomUUID(),
    role: m.role === "system" ? "user" : m.role,
    content: m.content ?? "",
    toolCalls,
    createdAt: Date.now(),
  };
};

const buildMemoriesBlock = async (): Promise<string | null> => {
  const memories = await listMemories(MEMORIES_IN_CONTEXT);
  if (memories.length === 0) return null;
  const bullets = memories.map((m) => `- ${m.fact}`).join("\n");
  return `What you know about the user from past conversations:\n${bullets}`;
};

const buildHistoryWithCompression = async (
  messages: ChatMessage[],
): Promise<LlmMessage[]> => {
  if (messages.length <= COMPRESS_THRESHOLD) {
    return messages.map(dbToLlm);
  }

  const olderCount = messages.length - KEEP_RECENT;
  const older = messages.slice(0, olderCount);
  const recent = messages.slice(olderCount);

  log.info(
    `[compress] chat has ${messages.length} messages; summarizing ${older.length} older`,
  );
  const summary = await summarizeMessages(older);
  const summaryMsg: LlmMessage = {
    role: "system",
    content: `Earlier in this conversation: ${summary}`,
  };

  return [summaryMsg, ...recent.map(dbToLlm)];
};

export type SendOptions = {
  speak?: boolean;
};

// The speaker for the most recent voice-mode turn. A new request cancels it
// so the AI shuts up immediately when the user wants to say something else.
let activeSpeaker: StreamingSpeaker | null = null;

export const cancelActiveSpeech = (): void => {
  activeSpeaker?.cancel();
  activeSpeaker = null;
};

export const sendMessage = async (
  chatId: string,
  userText: string,
  onChunk?: OnChunk,
  options: SendOptions = {},
): Promise<string> => {
  cancelActiveSpeech();

  const chat = await getChat(chatId);
  if (!chat) throw new Error(`Chat not found: ${chatId}`);

  const speaker = options.speak ? new StreamingSpeaker() : null;
  if (speaker) activeSpeaker = speaker;

  // 1. Persist user message immediately
  const userDbMessage: ChatMessage = {
    id: randomUUID(),
    role: "user",
    content: userText,
    createdAt: Date.now(),
  };
  await appendMessage(chatId, userDbMessage);

  // 2. Build LLM context: system + memories block + (summary + recent)
  const memoriesBlock = await buildMemoriesBlock();
  const historyMessages = await buildHistoryWithCompression(chat.messages);

  const llmMessages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(memoriesBlock ? [{ role: "system" as const, content: memoriesBlock }] : []),
    ...historyMessages,
  ];
  const initialLength = llmMessages.length;

  // 3. Stream LLM response. Each chunk both updates the renderer AND
  //    (if speaking) feeds the sentence-by-sentence speech queue.
  const combinedOnChunk: OnChunk = (text) => {
    onChunk?.(text);
    speaker?.push(text);
  };

  const reply = await call(llmMessages, userText, combinedOnChunk);
  speaker?.end();

  // 4. Persist all new messages the LLM produced (skip the user msg call() pushed)
  const newMessages = llmMessages.slice(initialLength + 1);
  for (const m of newMessages) {
    await appendMessage(chatId, llmToDb(m));
  }

  // 5. Fire-and-forget: extract durable facts from this turn
  void extractAndSaveMemories(chatId, [
    userDbMessage,
    ...newMessages.map(llmToDb),
  ]);

  return reply;
};
