import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// In a packaged Electron app, models live in <app>/Contents/Resources/models.
// In dev, they live in the project root.
const PACKAGED_RESOURCES = process.resourcesPath ?? "";
const IS_PACKAGED = PACKAGED_RESOURCES.includes(".app/Contents/Resources");
const MODELS_DIR = IS_PACKAGED
  ? join(PACKAGED_RESOURCES, "models")
  : join(__dirname, "..", "models");

export const OLLAMA_URL = "http://localhost:11434/api/chat";
export const MODEL = "llama3.2:3b";
export const WHISPER_MODEL = join(MODELS_DIR, "ggml-base.en.bin");
export const AUDIO_PATH = "/tmp/electron.wav";

export const SYSTEM_PROMPT = `You are Electron, a helpful local AI assistant running on the user's Mac.

You have access to tools that perform real actions on the user's computer. When the user asks you to do something a tool can do, you MUST call the tool — do not describe how to do it, do not write code, do not output the tool schema as text. Just call the tool.

After a tool returns, summarize the result in plain English. Never invent URLs, markdown images, or fake results.

Be concise.`;
