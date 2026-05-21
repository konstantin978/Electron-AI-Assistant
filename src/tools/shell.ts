import { exec } from "node:child_process";
import { promisify } from "node:util";
import { confirmInUi, type ConfirmRisk } from "../ai/confirm.js";
import { log } from "../utils/logger.js";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);

const SHELL_TIMEOUT_MS = 10_000;
const SHELL_MAX_BUFFER = 100_000;

// Patterns that indicate a destructive or irreversible action.
// If any matches, the UI shows a red "danger" confirmation requiring hold.
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+-[rfR]+/i, // rm -r, rm -rf
  /\brm\s+\//i, // rm at root
  /\bdd\s+if=/i, // disk dump
  /\bmkfs\b/i, // format filesystem
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
  /\bsudo\b/i,
  /\bsu\s/i,
  />\s*\/(?:etc|usr|bin|System|Library)/i, // redirect into system paths
  /\bchmod\s+(?:777|666|-R)/i,
  /\bchown\b.*\/(?:etc|usr|System)/i,
  /\bkillall\b/i,
  /\bkill\s+-9\s+1\b/, // kill init
  /\bdrop\s+(?:database|table)/i,
  /\bdiskutil\s+(?:erase|partition)/i,
  /\bformat\b/i,
];

const assessRisk = (command: string): ConfirmRisk =>
  DANGEROUS_PATTERNS.some((re) => re.test(command)) ? "danger" : "normal";

export const tools: Tool[] = [
  {
    def: {
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
    fn: async (args) => {
      const command = typeof args.command === "string" ? args.command : "";
      if (!command) return "Error: 'command' argument is required";

      const risk = assessRisk(command);
      const approved = await confirmInUi(
        `Run shell command:\n${command}`,
        risk,
      );
      if (!approved) return "Command denied by user.";

      log.info(`[shell] ${command} (risk=${risk})`);

      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: SHELL_TIMEOUT_MS,
          maxBuffer: SHELL_MAX_BUFFER,
        });
        let result = "";
        if (stdout) result += `STDOUT:\n${stdout.trim()}\n`;
        if (stderr) result += `STDERR:\n${stderr.trim()}\n`;
        return result.trim() || "(no output)";
      } catch (err) {
        return `Error running command: ${(err as Error).message}`;
      }
    },
  },
];
