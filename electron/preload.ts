import { contextBridge, ipcRenderer } from "electron";
import type { Chat, ChatMessage } from "../src/db/types.js";

export type ChatsApi = {
  list: () => Promise<Chat[]>;
  create: (chat: Chat) => Promise<void>;
  appendMessage: (chatId: string, message: ChatMessage) => Promise<void>;
  updateTitle: (chatId: string, title: string) => Promise<void>;
  delete: (chatId: string) => Promise<void>;
};

export type AiChunkPayload = { chatId: string; content: string };
export type AiChunkEndPayload = { chatId: string };

export type BatteryStatus = {
  percent: number;
  state: "charging" | "discharging" | "charged" | "unknown";
};

export type SystemApi = {
  battery: () => Promise<BatteryStatus | null>;
  onBattery: (callback: (status: BatteryStatus) => void) => () => void;
};

export type AiApi = {
  send: (
    chatId: string,
    userText: string,
    speak?: boolean,
  ) => Promise<string>;
  listen: () => Promise<string>;
  speak: (text: string) => Promise<void>;
  onHotkey: (callback: () => void) => () => void;
  onChunk: (callback: (payload: AiChunkPayload) => void) => () => void;
  onChunkEnd: (callback: (payload: AiChunkEndPayload) => void) => () => void;
};

const chatsApi: ChatsApi = {
  list: () => ipcRenderer.invoke("chats:list"),
  create: (chat) => ipcRenderer.invoke("chats:create", chat),
  appendMessage: (chatId, message) =>
    ipcRenderer.invoke("chats:append", chatId, message),
  updateTitle: (chatId, title) =>
    ipcRenderer.invoke("chats:update-title", chatId, title),
  delete: (chatId) => ipcRenderer.invoke("chats:delete", chatId),
};

const aiApi: AiApi = {
  send: (chatId, userText, speak = false) =>
    ipcRenderer.invoke("ai:send", chatId, userText, speak),
  listen: () => ipcRenderer.invoke("ai:listen"),
  speak: (text) => ipcRenderer.invoke("ai:speak", text),
  onHotkey: (callback) => {
    const wrapped = (): void => callback();
    ipcRenderer.on("hotkey:trigger", wrapped);
    return () => {
      ipcRenderer.removeListener("hotkey:trigger", wrapped);
    };
  },
  onChunk: (callback) => {
    const wrapped = (_e: unknown, payload: AiChunkPayload): void =>
      callback(payload);
    ipcRenderer.on("ai:chunk", wrapped);
    return () => {
      ipcRenderer.removeListener("ai:chunk", wrapped);
    };
  },
  onChunkEnd: (callback) => {
    const wrapped = (_e: unknown, payload: AiChunkEndPayload): void =>
      callback(payload);
    ipcRenderer.on("ai:chunk-end", wrapped);
    return () => {
      ipcRenderer.removeListener("ai:chunk-end", wrapped);
    };
  },
};

const systemApi: SystemApi = {
  battery: () => ipcRenderer.invoke("system:battery"),
  onBattery: (callback) => {
    const wrapped = (_e: unknown, status: BatteryStatus): void =>
      callback(status);
    ipcRenderer.on("battery:update", wrapped);
    return () => {
      ipcRenderer.removeListener("battery:update", wrapped);
    };
  },
};

contextBridge.exposeInMainWorld("chats", chatsApi);
contextBridge.exposeInMainWorld("ai", aiApi);
contextBridge.exposeInMainWorld("system", systemApi);
