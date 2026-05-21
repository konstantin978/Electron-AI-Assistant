import {
  app,
  globalShortcut,
  BrowserWindow,
  ipcMain,
  screen,
  systemPreferences,
} from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { speak } from "../src/tts.js";
import { recordAudio, transcribe } from "../src/stt.js";
import { WHISPER_MODEL, AUDIO_PATH } from "../src/config.js";
import { log } from "../src/utils/logger.js";
import { connectDb, closeDb } from "../src/db/index.js";
import {
  listChats,
  createChat,
  appendMessage,
  updateTitle,
  deleteChat,
} from "../src/db/chats.js";
import type { Chat, ChatMessage } from "../src/db/types.js";
import { sendMessage } from "../src/ai/bridge.js";
import { getBatteryStatus } from "../src/system/battery.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOTKEY = "CommandOrControl+Shift+J";
const DEV_URL = process.env.ELECTRON_DEV_URL ?? "http://localhost:5173";
const IS_DEV = process.env.ELECTRON_DEV === "1";
const PANEL_WIDTH = 480;

let mainWindow: BrowserWindow | null = null;

const getTargetDisplay = () => {
  const cursor = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursor);
};

const createWindow = (): void => {
  const { workArea } = getTargetDisplay();

  mainWindow = new BrowserWindow({
    x: workArea.x + workArea.width - PANEL_WIDTH,
    y: workArea.y,
    width: PANEL_WIDTH,
    height: workArea.height,
    frame: false,
    transparent: true,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 12, y: 14 },
    backgroundColor: "#00000000",
    hasShadow: true,
    resizable: false,
    movable: true,
    minWidth: 320,
    maxWidth: 520,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const repinRight = (): void => {
    if (!mainWindow) return;
    // Pin to the right edge of whichever display the window currently lives on
    const bounds = mainWindow.getBounds();
    const wa = screen.getDisplayMatching(bounds).workArea;
    const [w] = mainWindow.getSize();
    mainWindow.setBounds({
      x: wa.x + wa.width - w,
      y: wa.y,
      width: w,
      height: wa.height,
    });
  };
  screen.on("display-metrics-changed", repinRight);
  screen.on("display-added", repinRight);
  screen.on("display-removed", repinRight);

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

const handleHotkey = (): void => {
  // Notify the renderer to start its listening flow.
  // The renderer owns mic UI and conversation state.
  mainWindow?.webContents.send("hotkey:trigger");
};

const registerIpc = (): void => {
  // Chats CRUD
  ipcMain.handle("chats:list", () => listChats());
  ipcMain.handle("chats:create", (_e, chat: Chat) => createChat(chat));
  ipcMain.handle(
    "chats:append",
    (_e, chatId: string, message: ChatMessage) =>
      appendMessage(chatId, message),
  );
  ipcMain.handle(
    "chats:update-title",
    (_e, chatId: string, title: string) => updateTitle(chatId, title),
  );
  ipcMain.handle("chats:delete", (_e, chatId: string) => deleteChat(chatId));

  // AI orchestration with token streaming + optional sentence-by-sentence speech
  ipcMain.handle(
    "ai:send",
    async (e, chatId: string, userText: string, speakReply = false) => {
      log.info(
        `[ai:send] chat=${chatId} speak=${speakReply} text="${userText}"`,
      );
      const onChunk = (text: string): void => {
        e.sender.send("ai:chunk", { chatId, content: text });
      };
      try {
        const reply = await sendMessage(chatId, userText, onChunk, {
          speak: speakReply,
        });
        log.info(`[ai:reply] ${reply}`);
        return reply;
      } finally {
        e.sender.send("ai:chunk-end", { chatId });
      }
    },
  );

  ipcMain.handle("ai:listen", async () => {
    log.info("🎤 listening...");
    await recordAudio(AUDIO_PATH);
    const transcript = await transcribe(AUDIO_PATH, WHISPER_MODEL);
    log.info(`[transcribed] "${transcript}"`);
    return transcript;
  });

  ipcMain.handle("ai:speak", async (_e, text: string) => {
    await speak(text);
  });

  // System status
  ipcMain.handle("system:battery", () => getBatteryStatus());
};

const BATTERY_POLL_MS = 30_000;
let batteryTimer: NodeJS.Timeout | null = null;

const startBatteryPolling = (): void => {
  const tick = async (): Promise<void> => {
    const status = await getBatteryStatus();
    if (status && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("battery:update", status);
    }
  };
  void tick();
  batteryTimer = setInterval(() => void tick(), BATTERY_POLL_MS);
};

app.whenReady().then(async () => {
  // Request macOS mic permission up front so the OS prompt appears once,
  // not silently on first recording attempt.
  if (process.platform === "darwin") {
    const status = systemPreferences.getMediaAccessStatus("microphone");
    log.info(`mic access status: ${status}`);
    if (status !== "granted") {
      const granted = await systemPreferences.askForMediaAccess("microphone");
      log.info(`mic access granted: ${granted}`);
    }
  }

  try {
    await connectDb();
  } catch (err) {
    log.error(`DB connection failed: ${(err as Error).message}`);
    log.error("Is mongod running? Try: brew services start mongodb-community");
  }

  registerIpc();
  createWindow();
  startBatteryPolling();

  const ok = globalShortcut.register(HOTKEY, handleHotkey);
  if (!ok) log.error("hotkey registration failed");
  log.info(`Electron ready. Press ${HOTKEY} to talk.`);
});

app.on("will-quit", async () => {
  globalShortcut.unregisterAll();
  if (batteryTimer) clearInterval(batteryTimer);
  await closeDb();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
