import { exec } from "node:child_process";
import { promisify } from "node:util";
import { ask } from "../prompt.js";
import { log } from "../utils/logger.js";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);

const SHELL_TIMEOUT_MS = 10_000;
const SHELL_MAX_BUFFER = 100_000;

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

      const answer = await ask(
        `\n⚠️  AI wants to run: ${command}\nApprove? (y/N): `,
      );
      if (answer.toLowerCase() !== "y") return "Command denied by user.";

      log.info(`[shell] ${command}`);

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
