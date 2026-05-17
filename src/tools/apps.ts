import { spawn } from "node:child_process";
import type { Tool } from "./types.js";

const OPEN_BIN = "/usr/bin/open";
const OSASCRIPT_BIN = "/usr/bin/osascript";

const MUSIC_ACTIONS = [
  "play",
  "pause",
  "playpause",
  "next",
  "previous",
] as const;

type MusicAction = (typeof MUSIC_ACTIONS)[number];

const MUSIC_VERBS: Record<MusicAction, string> = {
  play: "play",
  pause: "pause",
  playpause: "playpause",
  next: "next track",
  previous: "previous track",
};

const openApp: Tool = {
  def: {
    type: "function",
    function: {
      name: "open_app",
      description:
        "Open a macOS application by name. Use full app names like 'Google Chrome' or 'Visual Studio Code'.",
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
  fn: async (args) => {
    const name = typeof args.name === "string" ? args.name.trim() : "";
    if (!name) return "Error: 'name' argument is required";

    try {
      await new Promise<void>((resolve, reject) => {
        const p = spawn(OPEN_BIN, ["-a", name]);
        p.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(
                new Error(
                  `open exited ${code} (app '${name}' may not be installed)`,
                ),
              ),
        );
        p.on("error", reject);
      });
      return `Opened ${name}`;
    } catch (err) {
      return `Error opening app: ${(err as Error).message}`;
    }
  },
};

const controlMusic: Tool = {
  def: {
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
            enum: [...MUSIC_ACTIONS],
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
  fn: async (args) => {
    const action =
      typeof args.action === "string" &&
      MUSIC_ACTIONS.includes(args.action as MusicAction)
        ? (args.action as MusicAction)
        : null;
    if (!action) {
      return `Error: 'action' must be one of ${MUSIC_ACTIONS.join(", ")}`;
    }
    const app =
      args.app === "Music" || args.app === "Spotify" ? args.app : "Spotify";

    const script = `tell application "${app}" to ${MUSIC_VERBS[action]}`;

    try {
      await new Promise<void>((resolve, reject) => {
        const p = spawn(OSASCRIPT_BIN, ["-e", script]);
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
};

export const tools: Tool[] = [openApp, controlMusic];
