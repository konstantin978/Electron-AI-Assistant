import { spawn } from "node:child_process";

const escape = (s: string): string => s.replace(/"/g, '\\"');

export const showNotification = (
  message: string,
  title = "Jarvis",
): Promise<void> =>
  new Promise((resolve, reject) => {
    const script = `display notification "${escape(message)}" with title "${escape(title)}"`;
    const p = spawn("/usr/bin/osascript", ["-e", script]);
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`osascript exited ${code}`)),
    );
    p.on("error", reject);
  });
