import type {
  ChatsApi,
  AiApi,
  SystemApi,
  ConfirmApi,
} from "../preload.js";

declare global {
  interface Window {
    chats: ChatsApi;
    ai: AiApi;
    system: SystemApi;
    approval: ConfirmApi;
  }
}

export {};
