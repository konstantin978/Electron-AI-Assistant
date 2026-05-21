import type { AiChunkEndPayload, AiChunkPayload } from "../../preload.js";

export const aiStore = {
  send: (
    chatId: string,
    userText: string,
    speak = false,
  ): Promise<string> => window.ai.send(chatId, userText, speak),

  listen: (): Promise<string> => window.ai.listen(),

  speak: (text: string): Promise<void> => window.ai.speak(text),

  onHotkey: (callback: () => void): (() => void) =>
    window.ai.onHotkey(callback),

  onChunk: (callback: (payload: AiChunkPayload) => void): (() => void) =>
    window.ai.onChunk(callback),

  onChunkEnd: (callback: (payload: AiChunkEndPayload) => void): (() => void) =>
    window.ai.onChunkEnd(callback),
};
