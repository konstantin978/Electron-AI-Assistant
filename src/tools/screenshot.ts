import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { expandPath } from "../utils/path.js";
import type { Tool } from "./types.js";

const SCREENCAPTURE_BIN = "/usr/sbin/screencapture";

export const tools: Tool[] = [
  {
    def: {
      type: "function",
      function: {
        name: "take_screenshot",
        description:
          "Capture the entire screen and save it as a PNG. Returns the saved file path. Do not embed the image in markdown or invent URLs — just tell the user the file path.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Optional absolute path where to save the PNG. If omitted, saves to ~/Desktop with a timestamped name.",
            },
          },
          required: [],
        },
      },
    },
    fn: async (args) => {
      const givenPath =
        typeof args.path === "string" ? expandPath(args.path) : "";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const finalPath =
        givenPath || `${homedir()}/Desktop/screenshot-${timestamp}.png`;

      try {
        await new Promise<void>((resolve, reject) => {
          const p = spawn(SCREENCAPTURE_BIN, [finalPath]);
          p.on("close", (code) =>
            code === 0
              ? resolve()
              : reject(new Error(`screencapture exited ${code}`)),
          );
          p.on("error", reject);
        });
        return `Screenshot saved to ${finalPath}`;
      } catch (err) {
        return `Error taking screenshot: ${(err as Error).message}`;
      }
    },
  },
];
