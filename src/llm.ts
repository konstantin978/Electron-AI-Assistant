import { toolDefs, toolFns } from "./tools/index.js";
import { OLLAMA_URL, MODEL } from "./config.js";
import { log } from "./utils/logger.js";

export type Role = "system" | "user" | "assistant" | "tool";

export type ToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
};

export type Message = {
  role: Role;
  content?: string;
  tool_calls?: ToolCall[];
};

type OllamaChatResponse = {
  message: Message;
};

type OllamaStreamChunk = {
  message: Message;
  done: boolean;
};

export type OnChunk = (text: string) => void;

const requestOllama = async (
  messages: Message[],
  stream: boolean,
): Promise<Response> =>
  fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: toolDefs,
      stream,
      options: {
        temperature: 0,
      },
    }),
  });

/**
 * Lightweight LLM call with no tools attached. Used by summarization
 * and memory extraction — tasks that should produce plain text only.
 */
export const simpleCompletion = async (
  messages: Message[],
  temperature = 0.3,
): Promise<string> => {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      options: { temperature },
    }),
  });
  const data = (await response.json()) as OllamaChatResponse;
  return data.message.content ?? "";
};

const readStreamedMessage = async (
  response: Response,
  onChunk: OnChunk,
): Promise<Message> => {
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const assembled: Message = { role: "assistant", content: "" };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = JSON.parse(trimmed) as OllamaStreamChunk;
      const piece = parsed.message.content ?? "";
      if (piece) {
        assembled.content = (assembled.content ?? "") + piece;
        onChunk(piece);
      }
      if (parsed.message.tool_calls && parsed.message.tool_calls.length > 0) {
        assembled.tool_calls = parsed.message.tool_calls;
      }
    }
  }

  return assembled;
};

export const call = async (
  messages: Message[],
  userText: string | null,
  onChunk?: OnChunk,
): Promise<string> => {
  if (userText) messages.push({ role: "user", content: userText });

  const useStream = !!onChunk;
  const response = await requestOllama(messages, useStream);

  const msg: Message = useStream
    ? await readStreamedMessage(response, onChunk)
    : ((await response.json()) as OllamaChatResponse).message;

  messages.push(msg);

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    for (const tc of msg.tool_calls) {
      log.tool(tc.function.name, tc.function.arguments);
      const fn = toolFns[tc.function.name];
      const result = fn
        ? await fn(tc.function.arguments)
        : `Unknown tool: ${tc.function.name}`;
      log.toolResult(result);
      messages.push({ role: "tool", content: String(result) });
    }
    return call(messages, null, onChunk);
  }

  return msg.content ?? "";
};
