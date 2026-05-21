import type { ChatsApi, AiApi, SystemApi } from "../preload.js";

declare global {
  interface Window {
    chats: ChatsApi;
    ai: AiApi;
    system: SystemApi;
  }
}

export {};
