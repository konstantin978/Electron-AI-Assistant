import { speak, cancelSpeech } from "../tts.js";
import { log } from "../utils/logger.js";

/**
 * Sentence-by-sentence speech for streaming TTS.
 *
 * As tokens arrive, accumulate into a buffer. When a sentence-ending
 * punctuation mark is found, extract complete sentences and enqueue
 * them for serial speech via macOS `say`. The user hears the AI start
 * talking ~1s after the reply begins instead of waiting for the whole thing.
 */
export class StreamingSpeaker {
  private buffer = "";
  private queue: Promise<void> = Promise.resolve();
  private cancelled = false;

  push(chunk: string): void {
    if (this.cancelled) return;
    this.buffer += chunk;
    this.flushReady();
  }

  end(): void {
    if (this.cancelled) return;
    const tail = this.buffer.trim();
    this.buffer = "";
    if (tail.length > 0) this.enqueue(tail);
  }

  cancel(): void {
    this.cancelled = true;
    this.buffer = "";
    this.queue = Promise.resolve();
    cancelSpeech();
  }

  private flushReady(): void {
    // Match anything up to a sentence terminator (.!?), optionally followed by
    // whitespace. Anything after the last terminator stays in the buffer.
    const re = /([^.!?\n]*[.!?\n]+)\s*/g;
    let lastIndex = 0;
    let match;
    while ((match = re.exec(this.buffer)) !== null) {
      const sentence = match[1].trim();
      if (sentence.length > 0) this.enqueue(sentence);
      lastIndex = re.lastIndex;
    }
    if (lastIndex > 0) this.buffer = this.buffer.slice(lastIndex);
  }

  private enqueue(sentence: string): void {
    this.queue = this.queue
      .then(() => {
        if (this.cancelled) return;
        return speak(sentence);
      })
      .catch((err: Error) => {
        log.warn(`speech queue error: ${err.message}`);
      });
  }
}
