import type { Chat, ChatMessage } from "../types.js";

export const chatStore = {
  list: (): Promise<Chat[]> => window.chats.list(),

  create: (chat: Chat): Promise<void> => window.chats.create(chat),

  appendMessage: (chatId: string, message: ChatMessage): Promise<void> =>
    window.chats.appendMessage(chatId, message),

  updateTitle: (chatId: string, title: string): Promise<void> =>
    window.chats.updateTitle(chatId, title),

  delete: (chatId: string): Promise<void> => window.chats.delete(chatId),
};
