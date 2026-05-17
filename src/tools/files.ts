import { readFileSync, readdirSync, statSync } from "node:fs";
import { expandPath } from "../utils/path.js";
import type { Tool } from "./types.js";

const MAX_FILE_SIZE = 50_000;
const MAX_DIR_ENTRIES = 200;

const readFile: Tool = {
  def: {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a text file from disk and return it as a string",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The absolute file path to read",
          },
        },
        required: ["path"],
      },
    },
  },
  fn: (args) => {
    const path = typeof args.path === "string" ? expandPath(args.path) : "";
    if (!path) return "Error: 'path' argument is required";
    try {
      const stats = statSync(path);
      if (stats.size > MAX_FILE_SIZE) {
        return `Error: file too large (${stats.size} bytes). Max ${MAX_FILE_SIZE} bytes.`;
      }
      return readFileSync(path, "utf8");
    } catch (err) {
      return `Error reading file: ${(err as Error).message}`;
    }
  },
};

const listDirectory: Tool = {
  def: {
    type: "function",
    function: {
      name: "list_directory",
      description:
        "List the files and subdirectories of a directory. Returns names one per line.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The absolute directory path to list",
          },
        },
        required: ["path"],
      },
    },
  },
  fn: (args) => {
    const path = typeof args.path === "string" ? expandPath(args.path) : "";
    if (!path) return "Error: 'path' argument is required";
    try {
      const entries = readdirSync(path, { withFileTypes: true });
      if (entries.length === 0) return `${path}:\n(empty)`;

      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory())
          return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      const lines = sorted
        .slice(0, MAX_DIR_ENTRIES)
        .map((e) => (e.isDirectory() ? `📁 ${e.name}/` : `📄 ${e.name}`));

      if (sorted.length > MAX_DIR_ENTRIES) {
        lines.push(`... (${sorted.length - MAX_DIR_ENTRIES} more)`);
      }

      return `${path}:\n${lines.join("\n")}`;
    } catch (err) {
      return `Error reading directory: ${(err as Error).message}`;
    }
  },
};

export const tools: Tool[] = [readFile, listDirectory];
