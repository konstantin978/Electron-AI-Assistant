import { spawn, type ChildProcess } from "node:child_process";

// Track the currently-speaking process so it can be killed mid-utterance
// when the user sends a new request.
let current: ChildProcess | null = null;

export const speak = (text: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const p = spawn("/usr/bin/say", [text]);
    current = p;
    p.on("close", () => {
      if (current === p) current = null;
      resolve();
    });
    p.on("error", (err) => {
      if (current === p) current = null;
      reject(err);
    });
  });

export const cancelSpeech = (): void => {
  if (current) {
    current.kill("SIGTERM");
    current = null;
  }
};
