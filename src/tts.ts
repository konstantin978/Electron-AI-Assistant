import { spawn, type ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";

// afplay volume range is 0.0–2.0 (1.0 = unity). 2.0 = double the default.
const PLAYBACK_VOLUME = 2.0;

// Track the currently-active child process (say or afplay) so it can be
// killed mid-utterance when the user sends a new request.
let current: ChildProcess | null = null;

const setCurrent = (p: ChildProcess | null): void => {
  current = p;
};

const clearIfCurrent = (p: ChildProcess): void => {
  if (current === p) current = null;
};

export const speak = async (text: string): Promise<void> => {
  const tmpFile = join(
    tmpdir(),
    `electron-tts-${randomBytes(4).toString("hex")}.aiff`,
  );

  try {
    // Stage 1: render audio with `say` to a temp file.
    await new Promise<void>((resolve, reject) => {
      const say = spawn("/usr/bin/say", ["-o", tmpFile, text]);
      setCurrent(say);
      say.on("close", (code) => {
        clearIfCurrent(say);
        if (code === 0) resolve();
        else reject(new Error(`say exited ${code}`));
      });
      say.on("error", (err) => {
        clearIfCurrent(say);
        reject(err);
      });
    });

    // Stage 2: play it back with volume gain.
    await new Promise<void>((resolve, reject) => {
      const player = spawn("/usr/bin/afplay", [
        "-v",
        String(PLAYBACK_VOLUME),
        tmpFile,
      ]);
      setCurrent(player);
      player.on("close", () => {
        clearIfCurrent(player);
        resolve();
      });
      player.on("error", (err) => {
        clearIfCurrent(player);
        reject(err);
      });
    });
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
};

export const cancelSpeech = (): void => {
  if (current) {
    current.kill("SIGTERM");
    current = null;
  }
};
