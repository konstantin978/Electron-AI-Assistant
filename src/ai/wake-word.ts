import { spawn, type ChildProcess } from "node:child_process";
import { WAKE_WORD, WHISPER_TINY_MODEL } from "../config.js";
import { log } from "../utils/logger.js";

const WHISPER_STREAM_BIN = "/usr/local/bin/whisper-stream";

// Strict wake: "electron" must be near the start of an utterance.
const WAKE_MATCH_RE = /^[\s\W]*(electron|elektron)\b/i;
const CANCEL_MATCH_RE =
  /^[\s\W]*(cancel|stop|wait|quiet|nevermind|never mind|shut up)\b/i;

// Whisper hallucinates these on silence — never act on them.
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
  "[ pause ]",
  "[pause]",
]);
const MIN_TRANSCRIPT_LEN = 4;

// After firing a wake/cancel, ignore further transcripts for this long
// so the same utterance doesn't fire twice.
const COOLDOWN_MS = 2500;

const isHallucination = (text: string): boolean => {
  const normalized = text.trim().toLowerCase();
  if (normalized.length < MIN_TRANSCRIPT_LEN) return true;
  return HALLUCINATIONS.has(normalized);
};

export type WakeHandlers = {
  /** User said the wake word ("electron …") — start the listen flow. */
  onWake: () => void;
  /** User said a cancel word ("cancel", "stop", …) — abort current speech. */
  onCancel: () => void;
};

/**
 * Continuous wake-word listener backed by whisper-stream.
 *
 * Holds the mic open the whole time (no rec cycling). Each transcript line
 * whisper-stream prints is checked against the wake/cancel patterns.
 */
export class WakeWordLoop {
  private proc: ChildProcess | null = null;
  private handlers: WakeHandlers;
  private lastFireAt = 0;
  private paused = false;
  private stdoutBuffer = "";

  constructor(handlers: WakeHandlers) {
    this.handlers = handlers;
  }

  start(): void {
    if (this.proc) return;
    log.info(`[wake] listening for "${WAKE_WORD}" (whisper-stream)`);
    this.spawnStream();
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.killProc();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.spawnStream();
  }

  stop(): void {
    this.paused = true;
    this.killProc();
  }

  private killProc(): void {
    if (this.proc) {
      this.proc.kill("SIGTERM");
      this.proc = null;
    }
    this.stdoutBuffer = "";
  }

  private spawnStream(): void {
    // -c 1: capture device 1 = "MacBook Pro Microphone" (avoid iPhone mic
    //       that often appears as device 0 when paired).
    // --step 1500ms: process audio every 1.5s for near-real-time detection.
    // --length 5000ms: each window is 5s for context.
    // --keep 200ms: small overlap so wake words at boundaries aren't missed.
    this.proc = spawn(WHISPER_STREAM_BIN, [
      "-m", WHISPER_TINY_MODEL,
      "-c", "1",
      "-t", "4",
      "--step", "1500",
      "--length", "5000",
      "--keep", "200",
      "-vth", "0.5",
      "-l", "en",
    ]);

    this.proc.stdout?.on("data", (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString();
      // whisper-stream uses terminal redraws (\x1b[2K clear-line) to update
      // partial transcripts in place. Treat both that escape and newlines
      // as segment delimiters.
      // eslint-disable-next-line no-control-regex
      const segments = this.stdoutBuffer.split(/\x1b\[2K|\r|\n/);
      this.stdoutBuffer = segments.pop() ?? "";
      for (const seg of segments) this.processLine(seg);
    });

    this.proc.stderr?.on("data", () => {
      // whisper-stream prints lots of init noise to stderr; ignore
    });

    this.proc.on("close", (code) => {
      this.proc = null;
      if (!this.paused) {
        log.warn(`[wake] whisper-stream exited ${code}; respawning in 2s`);
        setTimeout(() => {
          if (!this.paused) this.spawnStream();
        }, 2000);
      }
    });

    this.proc.on("error", (err) => {
      log.error(`[wake] whisper-stream error: ${err.message}`);
    });
  }

  private processLine(rawLine: string): void {
    // Strip any leftover ANSI escape sequences (cursor moves, colors, etc.)
    // eslint-disable-next-line no-control-regex
    const line = rawLine.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").trim();

    if (!line) return;
    if (line.startsWith("###")) return;
    // [BLANK_AUDIO] / [silence] markers — Whisper's "no speech" output
    if (/^\[[^\]]+\]$/.test(line)) return;

    if (isHallucination(line)) return;

    const now = Date.now();
    if (now - this.lastFireAt < COOLDOWN_MS) return;

    if (CANCEL_MATCH_RE.test(line)) {
      log.info(`[wake] cancel: "${line}"`);
      this.lastFireAt = now;
      this.handlers.onCancel();
      return;
    }

    if (WAKE_MATCH_RE.test(line)) {
      log.info(`[wake] detected: "${line}"`);
      this.lastFireAt = now;
      this.handlers.onWake();
    }
  }
}
