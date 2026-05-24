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

export type SystemStats = {
  cpu: number;
  memUsed: number;
  memTotal: number;
  memPercent: number;
};

export type ProcessInfo = {
  pid: number;
  cpu: number;
  mem: number;
  command: string;
};

export type ProcessCounts = {
  processes: number;
  threads: number;
};

export type SystemApi = {
  battery: () => Promise<BatteryStatus | null>;
  onBattery: (callback: (status: BatteryStatus) => void) => () => void;
  stats: () => Promise<SystemStats>;
  onStats: (callback: (stats: SystemStats) => void) => () => void;
  processes: () => Promise<ProcessInfo[]>;
  counts: () => Promise<ProcessCounts>;
};

export type ConfirmRequest = {
  id: string;
  question: string;
  risk: "normal" | "danger";
};

export type ConfirmApi = {
  onRequest: (callback: (req: ConfirmRequest) => void) => () => void;
  respond: (id: string, ok: boolean) => Promise<void>;
};

export type AiApi = {
  send: (
    chatId: string,
    userText: string,
    speak?: boolean,
  ) => Promise<string>;
  listen: () => Promise<string>;
  speak: (text: string) => Promise<void>;
  cancel: () => Promise<void>;
  onHotkey: (callback: () => void) => () => void;
  onWake: (callback: () => void) => () => void;
  onCancel: (callback: () => void) => () => void;
  onChunk: (callback: (payload: AiChunkPayload) => void) => () => void;
  onChunkEnd: (callback: (payload: AiChunkEndPayload) => void) => () => void;
  onSpeechDone: (callback: (payload: AiChunkEndPayload) => void) => () => void;
  onListenPartial: (callback: (text: string) => void) => () => void;
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
  cancel: () => ipcRenderer.invoke("ai:cancel"),
  onHotkey: (callback) => {
    const wrapped = (): void => callback();
    ipcRenderer.on("hotkey:trigger", wrapped);
    return () => {
      ipcRenderer.removeListener("hotkey:trigger", wrapped);
    };
  },
  onWake: (callback) => {
    const wrapped = (): void => callback();
    ipcRenderer.on("wake:detected", wrapped);
    return () => {
      ipcRenderer.removeListener("wake:detected", wrapped);
    };
  },
  onCancel: (callback) => {
    const wrapped = (): void => callback();
    ipcRenderer.on("wake:cancelled", wrapped);
    return () => {
      ipcRenderer.removeListener("wake:cancelled", wrapped);
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
  onSpeechDone: (callback) => {
    const wrapped = (_e: unknown, payload: AiChunkEndPayload): void =>
      callback(payload);
    ipcRenderer.on("ai:speech-done", wrapped);
    return () => {
      ipcRenderer.removeListener("ai:speech-done", wrapped);
    };
  },
  onListenPartial: (callback) => {
    const wrapped = (_e: unknown, payload: { text: string }): void =>
      callback(payload.text);
    ipcRenderer.on("listen:partial", wrapped);
    return () => {
      ipcRenderer.removeListener("listen:partial", wrapped);
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
  stats: () => ipcRenderer.invoke("system:stats"),
  onStats: (callback) => {
    const wrapped = (_e: unknown, stats: SystemStats): void => callback(stats);
    ipcRenderer.on("system:stats:update", wrapped);
    return () => {
      ipcRenderer.removeListener("system:stats:update", wrapped);
    };
  },
  processes: () => ipcRenderer.invoke("system:processes"),
  counts: () => ipcRenderer.invoke("system:counts"),
};

const confirmApi: ConfirmApi = {
  onRequest: (callback) => {
    const wrapped = (_e: unknown, req: ConfirmRequest): void => callback(req);
    ipcRenderer.on("confirm:request", wrapped);
    return () => {
      ipcRenderer.removeListener("confirm:request", wrapped);
    };
  },
  respond: (id, ok) => ipcRenderer.invoke("confirm:response", id, ok),
};

contextBridge.exposeInMainWorld("chats", chatsApi);
contextBridge.exposeInMainWorld("ai", aiApi);
contextBridge.exposeInMainWorld("system", systemApi);
contextBridge.exposeInMainWorld("approval", confirmApi);
