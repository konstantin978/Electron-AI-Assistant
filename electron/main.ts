import { app, globalShortcut, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { call, type Message } from "../src/llm.js";
import { speak } from "../src/tts.js";
import { recordAudio, transcribe } from "../src/stt.js";
import { WHISPER_MODEL, AUDIO_PATH, SYSTEM_PROMPT } from "../src/config.js";
import { log } from "../src/utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOTKEY = "CommandOrControl+Shift+J";
const DEV_URL = "http://localhost:5173";
const IS_DEV = process.env.ELECTRON_DEV === "1";

const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 580,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (IS_DEV) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

const handleHotkey = async (): Promise<void> => {
  try {
    log.info("🎤 listening...");
    await recordAudio(AUDIO_PATH);
    const userText = await transcribe(AUDIO_PATH, WHISPER_MODEL);
    log.info(`you: ${userText}`);
    if (!userText) return;
    const reply = await call(messages, userText);
    log.info(`ai: ${reply}`);
    await speak(reply);
  } catch (err) {
    log.error(`hotkey error: ${(err as Error).message}`);
  }
};

app.whenReady().then(() => {
  createWindow();

  const ok = globalShortcut.register(HOTKEY, handleHotkey);
  if (!ok) log.error("hotkey registration failed");
  log.info(`Electron ready. Press ${HOTKEY} to talk.`);
});

app.on("will-quit", () => globalShortcut.unregisterAll());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
