import { spawn } from "node:child_process";
import { WHISPER_MODEL } from "./config.js";
import { log } from "./utils/logger.js";

const WHISPER_STREAM_BIN = "/usr/local/bin/whisper-stream";

/** After the user has said something, auto-stop after this much silence. */
const SILENCE_AFTER_SPEECH_MS = 2_500;
/** If the user never speaks, give up after this long. */
const MAX_WAIT_FOR_SPEECH_MS = 12_000;
/** Hard cap on a single utterance. */
const MAX_TOTAL_MS = 45_000;

export type LiveSttOptions = {
  onPartial: (text: string) => void;
};

export const liveTranscribe = (options: LiveSttOptions): Promise<string> =>
  new Promise((resolve, reject) => {
    const proc = spawn(WHISPER_STREAM_BIN, [
      "-m", WHISPER_MODEL,
      "-t", "8",
      "--step", "700",
      "--length", "6000",
      "--keep", "300",
      "-vth", "0.5",
      "-l", "en",
    ]);

    let stdoutBuffer = "";
    let accumulated = "";
    let hasSpoken = false;
    let lastSpeechAt = 0;
    const startedAt = Date.now();
    let finished = false;

    const finish = (): void => {
      if (finished) return;
      finished = true;
      clearInterval(checker);
      clearTimeout(maxTimer);
      try {
        proc.kill("SIGTERM");
      } catch {
        /* already dead */
      }
      resolve(accumulated.trim());
    };

    const checker = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      // If the user never said anything, give up after MAX_WAIT_FOR_SPEECH_MS
      if (!hasSpoken && elapsed > MAX_WAIT_FOR_SPEECH_MS) {
        log.info("[stt-live] timeout: no speech detected");
        finish();
        return;
      }
      // If the user spoke and has been silent since, auto-stop
      if (hasSpoken && Date.now() - lastSpeechAt > SILENCE_AFTER_SPEECH_MS) {
        finish();
      }
    }, 200);

    const maxTimer = setTimeout(finish, MAX_TOTAL_MS);

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (
        text.includes("Capture device") ||
        text.includes("error") ||
        text.includes("failed") ||
        text.includes("obtained spec") ||
        text.includes("attempt to open")
      ) {
        log.info(`[stt-live] ${text.trim()}`);
      }
    });

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      // eslint-disable-next-line no-control-regex
      const segments = stdoutBuffer.split(/\x1b\[2K|\r|\n/);
      stdoutBuffer = segments.pop() ?? "";
      for (const seg of segments) {
        // eslint-disable-next-line no-control-regex
        const cleaned = seg.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").trim();
        if (!cleaned) continue;
        if (cleaned.startsWith("###")) continue;
        // [BLANK_AUDIO], [silence] — whisper says nothing was heard
        if (/^\[[^\]]+\]$/.test(cleaned)) continue;

        // Real transcript content
        if (cleaned !== accumulated) {
          accumulated = cleaned;
          hasSpoken = true;
          lastSpeechAt = Date.now();
          options.onPartial(cleaned);
        }
      }
    });

    proc.on("close", () => {
      if (!finished) {
        finished = true;
        clearInterval(checker);
        clearTimeout(maxTimer);
        resolve(accumulated.trim());
      }
    });

    proc.on("error", (err) => {
      log.error(`[stt-live] whisper-stream error: ${err.message}`);
      if (!finished) {
        finished = true;
        clearInterval(checker);
        clearTimeout(maxTimer);
        reject(err);
      }
    });
  });
