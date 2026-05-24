import type { AiChunkEndPayload, AiChunkPayload } from "../../preload.js";

export const aiStore = {
  send: (
    chatId: string,
    userText: string,
    speak = false,
  ): Promise<string> => window.ai.send(chatId, userText, speak),

  listen: (): Promise<string> => window.ai.listen(),

  speak: (text: string): Promise<void> => window.ai.speak(text),

  cancel: (): Promise<void> => window.ai.cancel(),

  onHotkey: (callback: () => void): (() => void) =>
    window.ai.onHotkey(callback),

  onWake: (callback: () => void): (() => void) => window.ai.onWake(callback),

  onCancel: (callback: () => void): (() => void) =>
    window.ai.onCancel(callback),

  onChunk: (callback: (payload: AiChunkPayload) => void): (() => void) =>
    window.ai.onChunk(callback),

  onChunkEnd: (callback: (payload: AiChunkEndPayload) => void): (() => void) =>
    window.ai.onChunkEnd(callback),

  onSpeechDone: (
    callback: (payload: AiChunkEndPayload) => void,
  ): (() => void) => window.ai.onSpeechDone(callback),

  onListenPartial: (callback: (text: string) => void): (() => void) =>
    window.ai.onListenPartial(callback),
};
