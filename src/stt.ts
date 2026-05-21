import { spawn } from "node:child_process";

export const recordAudio = (path: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const p = spawn(
      "/usr/local/bin/rec",
      [
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
        "0.3",
        "1%",
        "1",
        "1.8",
        "1.5%",
      ],
      {
        env: {
          ...process.env,
          // Force the Mac's built-in mic, ignoring any plugged-in
          // headphones/AirPods that might otherwise be the default input.
          AUDIODRIVER: "coreaudio",
          AUDIODEV: "MacBook Pro Microphone",
        },
      },
    );
    let err = "";
    p.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });
    p.stderr.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `rec exited ${code}\nSTDERR: ${err.trim() || "(empty — likely no mic permission)"}`,
            ),
          ),
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
      "-t",
      "8",
      "-bo",
      "1",
      "-bs",
      "1",
    ]);
    let out = "";
    let err = "";
    p.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });
    p.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });
    p.stdout.on("error", reject);
    p.stderr.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve(out.trim())
        : reject(
            new Error(
              `whisper-cli exited ${code}\nSTDERR: ${err.trim() || "(empty)"}\nSTDOUT: ${out.trim() || "(empty)"}\nmodel: ${modelPath}\naudio: ${audioPath}`,
            ),
          ),
    );
    p.on("error", reject);
  });
