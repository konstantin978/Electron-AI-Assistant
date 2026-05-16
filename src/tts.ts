import { spawn } from "node:child_process";

export const speak = (text: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const p = spawn("/usr/bin/say", [text]);
    p.on("close", () => resolve());
    p.on("error", reject);
  });
