export type ChatRole = "user" | "assistant" | "tool";

export type ToolCallRecord = {
  name: string;
  args?: Record<string, unknown>;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  toolCalls?: ToolCallRecord[];
  createdAt: number;
};

export type Chat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export type Memory = {
  id: string;
  fact: string;
  sourceChatId: string;
  createdAt: number;
};
