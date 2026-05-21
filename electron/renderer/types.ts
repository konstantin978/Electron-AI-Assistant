export type Status = "idle" | "listening" | "thinking" | "speaking";

export type ToolCall = {
  name: string;
  args?: Record<string, unknown>;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  createdAt: number;
};

export type Chat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export type View =
  | { kind: "home" }
  | { kind: "history" }
  | { kind: "chat"; chatId: string };
