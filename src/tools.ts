import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { ask } from "./prompt.js";

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
  {
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
  {
    type: "function",
    function: {
      name: "run_shell",
      description:
        "Run a shell command on the user's machine and return stdout and stderr. Use for system queries (ls, ps, git status, etc) and simple file operations. Avoid destructive commands like rm -rf or anything that modifies system files.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "The full shell command to execute, e.g. 'ls -la' or 'git status'",
          },
        },
        required: ["command"],
      },
    },
  },
];

const execAsync = promisify(exec);

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

  list_directory: (args) => {
    const path = typeof args.path === "string" ? expandPath(args.path) : "";
    if (!path) return "Error: 'path' argument is required";
    try {
      const entries = readdirSync(path, { withFileTypes: true });
      if (entries.length === 0) return `${path}:\n(empty)`;

      const MAX = 200;
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory())
          return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      const lines = sorted
        .slice(0, MAX)
        .map((e) => (e.isDirectory() ? `📁 ${e.name}/` : `📄 ${e.name}`));

      if (sorted.length > MAX) {
        lines.push(`... (${sorted.length - MAX} more)`);
      }

      return `${path}:\n${lines.join("\n")}`;
    } catch (err) {
      return `Error reading directory: ${(err as Error).message}`;
    }
  },

  run_shell: async (args) => {
    const command = String(args.command ?? "");
    if (!command) return "Error: 'command' argument is required";

    const answer = await ask(
      `\n⚠️  AI wants to run: ${command}\nApprove? (y/N): `,
    );
    if (answer.toLowerCase() !== "y") return "Command denied by user.";

    console.log(`[shell] ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 10_000,
        maxBuffer: 100_000,
      });
      let result = "";
      if (stdout) result += `STDOUT:\n${stdout.trim()}\n`;
      if (stderr) result += `STDERR:\n${stderr.trim()}\n`;
      return result.trim() || "(no output)";
    } catch (err) {
      return `Error running command: ${(err as Error).message}`;
    }
  },
};
