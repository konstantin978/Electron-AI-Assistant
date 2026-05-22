import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { homedir, userInfo } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

const findProjectRoot = (start: string): string => {
  let dir = start;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = dirname(dir);
  }
  return start;
};

// In a packaged Electron app, resources live in <app>/Contents/Resources.
// In dev, process.resourcesPath points at Electron's own dev binary
// (.../node_modules/electron/dist/Electron.app/...), which is NOT what we want.
const PACKAGED_RESOURCES = process.resourcesPath ?? "";
const IS_PACKAGED =
  PACKAGED_RESOURCES.includes(".app/Contents/Resources") &&
  !PACKAGED_RESOURCES.includes("node_modules/electron");

const PROJECT_ROOT = findProjectRoot(__dirname);

const MODELS_DIR = IS_PACKAGED
  ? join(PACKAGED_RESOURCES, "models")
  : join(PROJECT_ROOT, "models");

export const OLLAMA_URL = "http://localhost:11434/api/chat";
export const MODEL = "qwen2.5:7b";
export const WHISPER_MODEL = join(MODELS_DIR, "ggml-small.en.bin");
export const WHISPER_TINY_MODEL = join(MODELS_DIR, "ggml-tiny.en.bin");
export const AUDIO_PATH = "/tmp/electron.wav";
export const WAKE_AUDIO_PATH = "/tmp/electron-wake.wav";

// Toggle continuous wake-word listening. Off by default — turn on via
// WAKE_WORD=1 in .env so users opt in to the always-on CPU cost.
export const WAKE_WORD_ENABLED = process.env.WAKE_WORD === "1";
export const WAKE_WORD = "electron";

const USER_HOME = homedir();
const USER_NAME = userInfo().username;

export const SYSTEM_PROMPT = `You are Electron, a local AI assistant.

USER CONTEXT (always true):
- Username: ${USER_NAME}
- Home directory: ${USER_HOME}
- Desktop: ${USER_HOME}/Desktop
- Documents: ${USER_HOME}/Documents
- Downloads: ${USER_HOME}/Downloads
When the user says "my desktop", "my files", "home folder", etc., use these absolute paths. Never guess a different username or invent paths.

CRITICAL: Before responding, ask yourself "Is the user explicitly asking me to perform an action on their Mac right now?"
- If YES → call the matching tool.
- If NO → answer in plain text. DO NOT call any tool.

The default answer is plain text. Tools are the exception, not the rule.

ONLY call a tool when the user explicitly asks for ONE of these:
- "what time is it" → get_current_time
- "read the file at X" / "list files in Y" → read_file / list_directory
- "run the command X" / "what's my git status" → run_shell
- "take a screenshot" → take_screenshot
- "open Spotify" / "play music" / "skip song" → open_app / control_music
- "what's in my clipboard" / "copy X to clipboard" → get_clipboard / set_clipboard
- "remind me in N seconds" / "show a notification" → set_timer / send_notification

For EVERYTHING else, respond with plain text only:
- Greetings ("hello", "can you hear me", "are you there") → plain reply
- Questions about facts, concepts, history, math → plain reply
- Jokes, chitchat, opinions → plain reply
- Code or writing help → plain reply

CRITICAL ANTI-HALLUCINATION RULES:
- When a tool returns an error (file not found, permission denied, etc.), state the error plainly. DO NOT invent results.
- When listing files or reading data, ONLY use what the tool actually returned. NEVER make up filenames, paths, or contents.
- If you don't know something and no tool gives it to you, say "I don't know" instead of guessing.

After a tool returns, summarize the result in one short sentence. Never invent URLs, images, or fake data.

Be concise. One or two sentences unless asked for more.`;
