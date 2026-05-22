import { spawn, type ChildProcess } from "node:child_process";
import { transcribe } from "../stt.js";
import {
  WAKE_AUDIO_PATH,
  WAKE_WORD,
  WHISPER_TINY_MODEL,
} from "../config.js";
import { log } from "../utils/logger.js";

const REC_BIN = "/usr/local/bin/rec";

// Strict wake match: "electron" must be one of the first three words of the
// utterance. This stops the loop from firing when the word appears casually
// mid-sentence and from triggering on hallucinated transcriptions.
const STRICT_MATCH_RE = /^[\s\W]*(electron|elektron)\b/i;

// Whisper tends to hallucinate these on silence / non-speech audio. Drop
// any clip whose entire transcript is one of these.
const HALLUCINATIONS = new Set([
  "",
  "you",
  "thanks",
  "thank you.",
  "thanks for watching.",
  "thanks for watching!",
  "(silence)",
  "[blank_audio]",
  "[ silence ]",
  "[silence]",
  ".",
  "...",
]);

const MIN_TRANSCRIPT_LEN = 4;

type LoopState = "idle" | "running" | "paused";

const isHallucination = (text: string): boolean => {
  const normalized = text.trim().toLowerCase();
  if (normalized.length < MIN_TRANSCRIPT_LEN) return true;
  return HALLUCINATIONS.has(normalized);
};

/**
 * Continuous, low-power wake-word listener.
 *
 * Records short utterances with sox's silence detection, transcribes them
 * with the tiny.en Whisper model, and fires `onDetected` only when the
 * wake word appears at the START of the utterance.
 *
 * Pauses when the main recording flow is active so the two `rec` processes
 * don't fight over the microphone.
 */
export class WakeWordLoop {
  private state: LoopState = "idle";
  private rec: ChildProcess | null = null;
  private onDetected: () => void;

  constructor(onDetected: () => void) {
    this.onDetected = onDetected;
  }

  start(): void {
    if (this.state !== "idle") return;
    this.state = "running";
    log.info(`[wake] listening for "${WAKE_WORD}"`);
    void this.loop();
  }

  pause(): void {
    if (this.state === "paused") return;
    this.state = "paused";
    if (this.rec) {
      this.rec.kill("SIGTERM");
      this.rec = null;
    }
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.state = "running";
    void this.loop();
  }

  stop(): void {
    this.state = "idle";
    if (this.rec) {
      this.rec.kill("SIGTERM");
      this.rec = null;
    }
  }

  private async loop(): Promise<void> {
    while (this.state === "running") {
      try {
        await this.recordClip();
        if (this.state !== "running") break;

        const text = await transcribe(WAKE_AUDIO_PATH, WHISPER_TINY_MODEL);
        if (this.state !== "running") break;

        if (isHallucination(text)) {
          log.info(`[wake] skip (hallucination): "${text}"`);
          continue;
        }
        if (!STRICT_MATCH_RE.test(text)) {
          log.info(`[wake] skip (no match): "${text}"`);
          continue;
        }

        log.info(`[wake] detected: "${text}"`);
        this.onDetected();
        // Pause so the trigger doesn't immediately re-fire on residual audio.
        // Caller (main process) will also pause us during the listen flow.
        this.state = "paused";
        setTimeout(() => {
          if (this.state === "paused") this.resume();
        }, 5000);
      } catch (err) {
        if (this.state === "running") {
          log.warn(`[wake] iteration failed: ${(err as Error).message}`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  private recordClip(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Tight loop: sensitive start (1%), short stop (0.4s @ 2%),
      // capped at 3s. Smaller window → fewer hallucinations + faster cycle.
      this.rec = spawn(
        REC_BIN,
        [
          "-q",
          "-r", "16000",
          "-c", "1",
          "-b", "16",
          WAKE_AUDIO_PATH,
          "trim", "0", "3",
          "silence",
          "1", "0.05", "1%",
          "1", "0.4", "2%",
        ],
        {
          env: {
            ...process.env,
            AUDIODRIVER: "coreaudio",
            AUDIODEV: "MacBook Pro Microphone",
          },
        },
      );
      this.rec.on("close", () => {
        this.rec = null;
        resolve();
      });
      this.rec.on("error", (err) => {
        this.rec = null;
        reject(err);
      });
    });
  }
}
