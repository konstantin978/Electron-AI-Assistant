import { spawn } from "node:child_process";

export const recordAudio = (path: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const p = spawn("/usr/local/bin/rec", [
      "-q",
      "-r",
      "16000",
      "-c",
      "1",
      "-b",
      "16",
      path,
      "silence",
      "1",
      "0.1",
      "3%",
      "1",
      "2.0",
      "3%",
    ]);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`rec exited ${code}`)),
    );
    p.on("error", reject);
  });

export const transcribe = (
  audioPath: string,
  modelPath: string,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const p = spawn("/usr/local/bin/whisper-cli", [
      "-m",
      modelPath,
      "-f",
      audioPath,
      "--no-timestamps",
      "--no-prints",
    ]);
    let out = "";
    p.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });
    p.on("close", (code) =>
      code === 0
        ? resolve(out.trim())
        : reject(new Error(`whisper-cli exited ${code}`)),
    );
    p.on("error", reject);
  });
