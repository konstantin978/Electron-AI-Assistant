import { writeFile, appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync, statSync } from "node:fs";
import { expandPath } from "../utils/path.js";
import { confirmInUi, type ConfirmRisk } from "../ai/confirm.js";
import { log } from "../utils/logger.js";
import type { Tool } from "./types.js";

const MAX_CONTENT_BYTES = 1_000_000; // 1 MB
const PREVIEW_CHARS = 400;

// Paths under these prefixes always require the red hold-to-confirm dialog.
const DANGEROUS_PREFIXES = [
  "/etc/",
  "/usr/",
  "/System/",
  "/Library/",
  "/bin/",
  "/sbin/",
  "/private/",
];

const assessRisk = (path: string): ConfirmRisk => {
  if (DANGEROUS_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return "danger";
  }
  return "normal";
};

export const tools: Tool[] = [
  {
    def: {
      type: "function",
      function: {
        name: "write_file",
        description:
          "Write text content to a file on disk. The user is asked to approve before the write happens. Use this to create or modify source code files, notes, configs, etc. Default mode overwrites; pass mode='append' to append instead.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Absolute file path to write to. Parent directories are created automatically.",
            },
            content: {
              type: "string",
              description: "The text content to write.",
            },
            mode: {
              type: "string",
              enum: ["overwrite", "append"],
              description:
                "Write mode. Defaults to 'overwrite' (replaces file contents). Use 'append' to add to the end.",
            },
          },
          required: ["path", "content"],
        },
      },
    },
    fn: async (args) => {
      const rawPath = typeof args.path === "string" ? args.path : "";
      if (!rawPath) return "Error: 'path' argument is required";

      const content = typeof args.content === "string" ? args.content : "";
      if (content === undefined || content === null) {
        return "Error: 'content' argument is required";
      }

      if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
        return `Error: content too large (max ${MAX_CONTENT_BYTES} bytes)`;
      }

      const mode = args.mode === "append" ? "append" : "overwrite";
      const path = expandPath(rawPath);

      // Decide risk: system paths or existing files = caution at minimum
      let risk = assessRisk(path);
      const exists = existsSync(path);
      let sizeNote = "";
      if (exists && mode === "overwrite") {
        try {
          const stats = statSync(path);
          sizeNote = ` (existing file: ${stats.size} bytes will be replaced)`;
          // Replacing an existing non-trivial file is at least worth raising
          if (risk === "normal" && stats.size > 0) risk = "normal";
        } catch {
          /* ignore stat errors */
        }
      }

      const preview =
        content.length > PREVIEW_CHARS
          ? `${content.slice(0, PREVIEW_CHARS)}\n…(${content.length - PREVIEW_CHARS} more chars)`
          : content;

      const question =
        `${mode === "append" ? "Append to" : "Write"} file:\n${path}${sizeNote}\n\n` +
        `Content:\n${preview}`;

      const approved = await confirmInUi(question, risk);
      if (!approved) return "Write denied by user.";

      try {
        await mkdir(dirname(path), { recursive: true });
        if (mode === "append") {
          await appendFile(path, content, "utf8");
        } else {
          await writeFile(path, content, "utf8");
        }
        log.info(`[write_file] ${mode} ${path} (${content.length} chars)`);
        return `${mode === "append" ? "Appended" : "Wrote"} ${content.length} characters to ${path}`;
      } catch (err) {
        return `Error writing file: ${(err as Error).message}`;
      }
    },
  },
];
