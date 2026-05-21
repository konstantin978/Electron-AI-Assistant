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
import { getSystemStats } from "../src/system/stats.js";
import {
  listProcesses,
  countProcessesAndThreads,
} from "../src/system/processes.js";
import {
  setConfirmWindow,
  resolveConfirmation,
} from "../src/ai/confirm.js";
import { cancelAllTimers } from "../src/tools/notifications.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOTKEY = "CommandOrControl+Shift+J";
const DEV_URL = process.env.ELECTRON_DEV_URL ?? "http://localhost:5173";
const IS_DEV = process.env.ELECTRON_DEV === "1";
// 16:9 window, sized to fit comfortably even on smaller laptops.
const WIN_WIDTH = 960;
const WIN_HEIGHT = 540;

let mainWindow: BrowserWindow | null = null;

const getTargetDisplay = () => {
  const cursor = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursor);
};

const createWindow = (): void => {
  const { workArea } = getTargetDisplay();

  // Center the 16:9 window on the active display
  const width = Math.min(WIN_WIDTH, workArea.width - 40);
  const height = Math.min(WIN_HEIGHT, workArea.height - 40);

  mainWindow = new BrowserWindow({
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
    frame: false,
    transparent: true,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 12, y: 14 },
    backgroundColor: "#00000000",
    hasShadow: true,
    resizable: true,
    movable: true,
    minWidth: 640,
    minHeight: 400,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (IS_DEV) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    setConfirmWindow(null);
    mainWindow = null;
  });

  setConfirmWindow(mainWindow);
};

const handleHotkey = (): void => {
  // Notify the renderer to start its listening flow.
  // The renderer owns mic UI and conversation state.
  mainWindow?.webContents.send("hotkey:trigger");
};

type Handler<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult> | TResult;

/**
 * Wrap an IPC handler so DB / native errors don't crash the channel.
 * Logs and re-throws so the renderer sees a real error instead of a hang.
 */
const safeHandle =
  <TArgs extends unknown[], TResult>(
    channel: string,
    fn: Handler<TArgs, TResult>,
  ): Handler<TArgs, TResult> =>
  async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (err) {
      log.error(`[ipc:${channel}] ${(err as Error).message}`);
      throw err;
    }
  };

const registerIpc = (): void => {
  // Chats CRUD
  ipcMain.handle("chats:list", safeHandle("chats:list", () => listChats()));
  ipcMain.handle(
    "chats:create",
    safeHandle("chats:create", (_e, chat: Chat) => createChat(chat)),
  );
  ipcMain.handle(
    "chats:append",
    safeHandle("chats:append", (_e, chatId: string, message: ChatMessage) =>
      appendMessage(chatId, message),
    ),
  );
  ipcMain.handle(
    "chats:update-title",
    safeHandle("chats:update-title", (_e, chatId: string, title: string) =>
      updateTitle(chatId, title),
    ),
  );
  ipcMain.handle(
    "chats:delete",
    safeHandle("chats:delete", (_e, chatId: string) => deleteChat(chatId)),
  );

  // AI orchestration with token streaming + optional sentence-by-sentence speech
  ipcMain.handle(
    "ai:send",
    safeHandle(
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
    ),
  );

  ipcMain.handle(
    "ai:listen",
    safeHandle("ai:listen", async () => {
      log.info("🎤 listening...");
      await recordAudio(AUDIO_PATH);
      const transcript = await transcribe(AUDIO_PATH, WHISPER_MODEL);
      log.info(`[transcribed] "${transcript}"`);
      return transcript;
    }),
  );

  ipcMain.handle(
    "ai:speak",
    safeHandle("ai:speak", (_e, text: string) => speak(text)),
  );

  // System status
  ipcMain.handle(
    "system:battery",
    safeHandle("system:battery", () => getBatteryStatus()),
  );
  ipcMain.handle(
    "system:stats",
    safeHandle("system:stats", () => getSystemStats()),
  );
  ipcMain.handle(
    "system:processes",
    safeHandle("system:processes", () => listProcesses()),
  );
  ipcMain.handle(
    "system:counts",
    safeHandle("system:counts", () => countProcessesAndThreads()),
  );

  // Confirmation responses from renderer
  ipcMain.handle("confirm:response", (_e, id: string, ok: boolean) =>
    resolveConfirmation(id, ok),
  );
};

const BATTERY_POLL_MS = 30_000;
const STATS_POLL_MS = 3_000;
let batteryTimer: NodeJS.Timeout | null = null;
let statsTimer: NodeJS.Timeout | null = null;

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

const startStatsPolling = (): void => {
  // Throwaway sample to warm up the cpu-time-delta calculation
  void getSystemStats();
  statsTimer = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const stats = await getSystemStats();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("system:stats:update", stats);
  }, STATS_POLL_MS);
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
  startStatsPolling();

  const ok = globalShortcut.register(HOTKEY, handleHotkey);
  if (!ok) log.error("hotkey registration failed");
  log.info(`Electron ready. Press ${HOTKEY} to talk.`);
});

app.on("will-quit", async () => {
  globalShortcut.unregisterAll();
  if (batteryTimer) clearInterval(batteryTimer);
  if (statsTimer) clearInterval(statsTimer);
  cancelAllTimers();
  await closeDb();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
