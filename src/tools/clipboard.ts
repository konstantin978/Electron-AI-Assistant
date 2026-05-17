import { spawn } from "node:child_process";
import type { Tool } from "./types.js";

const PBPASTE_BIN = "/usr/bin/pbpaste";
const PBCOPY_BIN = "/usr/bin/pbcopy";

const getClipboard: Tool = {
  def: {
    type: "function",
    function: {
      name: "get_clipboard",
      description:
        "Read the current contents of the macOS clipboard as text. Use when the user refers to 'what I copied' or asks you to act on copied content.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  fn: async () => {
    try {
      return await new Promise<string>((resolve, reject) => {
        const p = spawn(PBPASTE_BIN);
        let out = "";
        p.stdout.on("data", (chunk: Buffer) => {
          out += chunk.toString();
        });
        p.on("close", (code) =>
          code === 0
            ? resolve(out || "(clipboard is empty)")
            : reject(new Error(`pbpaste exited ${code}`)),
        );
        p.on("error", reject);
      });
    } catch (err) {
      return `Error reading clipboard: ${(err as Error).message}`;
    }
  },
};

const setClipboard: Tool = {
  def: {
    type: "function",
    function: {
      name: "set_clipboard",
      description:
        "Write text to the macOS clipboard, replacing whatever is currently copied.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text to copy into the clipboard",
          },
        },
        required: ["text"],
      },
    },
  },
  fn: async (args) => {
    const text = typeof args.text === "string" ? args.text : "";
    if (!text) return "Error: 'text' argument is required";

    try {
      await new Promise<void>((resolve, reject) => {
        const p = spawn(PBCOPY_BIN);
        p.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`pbcopy exited ${code}`)),
        );
        p.on("error", reject);
        p.stdin.write(text);
        p.stdin.end();
      });
      return `Copied ${text.length} characters to clipboard`;
    } catch (err) {
      return `Error writing clipboard: ${(err as Error).message}`;
    }
  },
};

export const tools: Tool[] = [getClipboard, setClipboard];
