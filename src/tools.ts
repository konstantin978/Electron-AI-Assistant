import { homedir } from "node:os";
import { promisify } from "node:util";
import { exec, spawn } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";

import { ask } from "./prompt.js";
import { speak } from "./tts.js";

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
  {
    type: "function",
    function: {
      name: "take_screenshot",
      description:
        "Takes screenshot of user screen and saves it in optional path",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Optional path where to save image",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_notification",
      description:
        "Show a native macOS notification banner immediately with a message and optional title.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The notification body text",
          },
          title: {
            type: "string",
            description: "Optional notification title. Defaults to 'Jarvis'.",
          },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_clipboard",
      description:
        "Read the current contents of the macOS clipboard as text. Use when the user refers to 'what I copied' or asks you to act on copied content.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
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
  {
    type: "function",
    function: {
      name: "control_music",
      description:
        "Control music playback in Spotify or Apple Music. Supports play, pause, playpause (toggle), next, and previous.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["play", "pause", "playpause", "next", "previous"],
            description: "The playback action to perform",
          },
          app: {
            type: "string",
            enum: ["Spotify", "Music"],
            description: "Which music app to control. Defaults to Spotify.",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_app",
      description:
        "Open a macOS application by name. Use full app names like 'Google Chrome' or 'Visual Studio Code', not shortcuts.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "The application name as shown in /Applications, e.g. 'Spotify', 'Google Chrome'",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_timer",
      description:
        "Schedule a notification to fire after a given number of seconds, with an optional message. Returns immediately.",
      parameters: {
        type: "object",
        properties: {
          seconds: {
            type: "number",
            description: "How many seconds until the timer fires",
          },
          message: {
            type: "string",
            description: "Optional message to announce when the timer fires",
          },
        },
        required: ["seconds"],
      },
    },
  },
];

const execAsync = promisify(exec);

const expandPath = (p: string): string =>
  p.startsWith("~/") ? p.replace("~", homedir()) : p;

const showNotification = (message: string, title = "Jarvis"): Promise<void> =>
  new Promise((resolve, reject) => {
    const script = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"`;
    const p = spawn("/usr/bin/osascript", ["-e", script]);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`osascript exited ${code}`)),
    );
    p.on("error", reject);
  });

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

  take_screenshot: async (args) => {
    const givenPath =
      typeof args.path === "string" ? expandPath(args.path) : "";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const finalPath =
      givenPath || `${homedir()}/Desktop/screenshot-${timestamp}.png`;

    try {
      await new Promise<void>((resolve, reject) => {
        const p = spawn("/usr/sbin/screencapture", [finalPath]);
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

  set_timer: (args) => {
    if (typeof args.seconds !== "number" || args.seconds <= 0) {
      return "Error: 'seconds' must be a positive number";
    }
    const MAX_SECONDS = 86_400;
    const seconds = Math.min(args.seconds, MAX_SECONDS);
    const message =
      typeof args.message === "string" && args.message
        ? args.message
        : "Timer done";

    setTimeout(() => {
      console.log(`\n⏰ ${message}`);
      speak(message).catch(() => {});
      showNotification(message).catch(() => {});
    }, seconds * 1000);

    return `Timer set for ${seconds} seconds: ${message}`;
  },

  send_notification: async (args) => {
    const message = typeof args.message === "string" ? args.message : "";
    if (!message) return "Error: 'message' argument is required";
    const title =
      typeof args.title === "string" && args.title ? args.title : "Jarvis";

    try {
      await showNotification(message, title);
      return `Notification sent: ${title} - ${message}`;
    } catch (err) {
      return `Error sending notification: ${(err as Error).message}`;
    }
  },

  get_clipboard: async () => {
    try {
      return await new Promise<string>((resolve, reject) => {
        const p = spawn("/usr/bin/pbpaste");
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

  set_clipboard: async (args) => {
    const text = typeof args.text === "string" ? args.text : "";
    if (!text) return "Error: 'text' argument is required";

    try {
      await new Promise<void>((resolve, reject) => {
        const p = spawn("/usr/bin/pbcopy");
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

  control_music: async (args) => {
    const VALID_ACTIONS = ["play", "pause", "playpause", "next", "previous"];
    const action = typeof args.action === "string" ? args.action : "";
    if (!VALID_ACTIONS.includes(action)) {
      return `Error: 'action' must be one of ${VALID_ACTIONS.join(", ")}`;
    }
    const app =
      args.app === "Music" || args.app === "Spotify" ? args.app : "Spotify";

    const verbMap: Record<string, string> = {
      play: "play",
      pause: "pause",
      playpause: "playpause",
      next: "next track",
      previous: "previous track",
    };
    const script = `tell application "${app}" to ${verbMap[action]}`;

    try {
      await new Promise<void>((resolve, reject) => {
        const p = spawn("/usr/bin/osascript", ["-e", script]);
        p.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`osascript exited ${code}`)),
        );
        p.on("error", reject);
      });
      return `${app}: ${action}`;
    } catch (err) {
      return `Error controlling music: ${(err as Error).message}`;
    }
  },

  open_app: async (args) => {
    const name = typeof args.name === "string" ? args.name.trim() : "";
    if (!name) return "Error: 'name' argument is required";

    try {
      await new Promise<void>((resolve, reject) => {
        const p = spawn("/usr/bin/open", ["-a", name]);
        p.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`open exited ${code} (app '${name}' may not be installed)`)),
        );
        p.on("error", reject);
      });
      return `Opened ${name}`;
    } catch (err) {
      return `Error opening app: ${(err as Error).message}`;
    }
  },
};
