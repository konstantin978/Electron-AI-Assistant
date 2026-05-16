import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
};

export type ToolFn = (
  args: Record<string, unknown>,
) => string | Promise<string>;

export const toolDefs: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Returns the current date and time",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
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
];

const expandPath = (p: string): string =>
  p.startsWith("~/") ? p.replace("~", homedir()) : p;

export const toolFns: Record<string, ToolFn> = {
  get_current_time: () => new Date().toISOString(),

  read_file: (args) => {
    const path = typeof args.path === "string" ? expandPath(args.path) : "";
    if (!path) return "Error: 'path' argument is required";
    try {
      const stats = statSync(path);
      if (stats.size > 50_000) {
        return `Error: file too large (${stats.size} bytes). Max 50KB.`;
      }
      return readFileSync(path, "utf8");
    } catch (err) {
      return `Error reading file: ${(err as Error).message}`;
    }
  },
};
