import { showNotification } from "../utils/notifier.js";
import { speak } from "../tts.js";
import { log } from "../utils/logger.js";
import type { Tool } from "./types.js";

const MAX_TIMER_SECONDS = 86_400;

const activeTimers = new Set<ReturnType<typeof setTimeout>>();

export const cancelAllTimers = (): void => {
  for (const t of activeTimers) clearTimeout(t);
  activeTimers.clear();
};

const sendNotification: Tool = {
  def: {
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
            description: "Optional notification title. Defaults to 'Electron'.",
          },
        },
        required: ["message"],
      },
    },
  },
  fn: async (args) => {
    const message = typeof args.message === "string" ? args.message : "";
    if (!message) return "Error: 'message' argument is required";
    const title =
      typeof args.title === "string" && args.title ? args.title : "Electron";

    try {
      await showNotification(message, title);
      return `Notification sent: ${title} - ${message}`;
    } catch (err) {
      return `Error sending notification: ${(err as Error).message}`;
    }
  },
};

const setTimer: Tool = {
  def: {
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
  fn: (args) => {
    if (typeof args.seconds !== "number" || args.seconds <= 0) {
      return "Error: 'seconds' must be a positive number";
    }
    const seconds = Math.min(args.seconds, MAX_TIMER_SECONDS);
    const message =
      typeof args.message === "string" && args.message
        ? args.message
        : "Timer done";

    const handle = setTimeout(() => {
      activeTimers.delete(handle);
      log.info(`\n⏰ ${message}`);
      speak(message).catch((err: Error) =>
        log.warn(`timer speak failed: ${err.message}`),
      );
      showNotification(message).catch((err: Error) =>
        log.warn(`timer notify failed: ${err.message}`),
      );
    }, seconds * 1000);
    activeTimers.add(handle);

    return `Timer set for ${seconds} seconds: ${message}`;
  },
};

export const tools: Tool[] = [sendNotification, setTimer];
