import { toolDefs, toolFns } from "./tools.js";
import { OLLAMA_URL, MODEL } from "./config.js";

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

export const call = async (
  messages: Message[],
  userText: string | null,
): Promise<string> => {
  if (userText) messages.push({ role: "user", content: userText });

  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: toolDefs,
      stream: false,
    }),
  });

  const data = (await response.json()) as OllamaChatResponse;
  const msg = data.message;
  messages.push(msg);

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    for (const tc of msg.tool_calls) {
      const fn = toolFns[tc.function.name];
      const result = fn
        ? await fn(tc.function.arguments)
        : `Unknown tool: ${tc.function.name}`;
      messages.push({ role: "tool", content: String(result) });
    }
    return call(messages, null);
  }

  return msg.content ?? "";
};
