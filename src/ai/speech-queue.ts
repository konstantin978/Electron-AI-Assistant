import { speak } from "../tts.js";

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

  push(chunk: string): void {
    this.buffer += chunk;
    this.flushReady();
  }

  end(): void {
    const tail = this.buffer.trim();
    this.buffer = "";
    if (tail.length > 0) this.enqueue(tail);
  }

  cancel(): void {
    this.buffer = "";
    // Existing queue will finish — `say` doesn't support mid-utterance interrupt
    // from outside without tracking PIDs. Acceptable for v1.
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
      .then(() => speak(sentence))
      .catch(() => {
        // Swallow speech errors — they shouldn't break the chat flow
      });
  }
}
