import { app, globalShortcut } from "electron";
import { call, type Message } from "../src/llm.js";
import { speak } from "../src/tts.js";
import { recordAudio, transcribe } from "../src/stt.js";
import { WHISPER_MODEL, AUDIO_PATH, SYSTEM_PROMPT } from "../src/config.js";

const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

const handleKeyPress = async (): Promise<void> => {
  try {
    console.log("🎤 listening...");
    await recordAudio(AUDIO_PATH);
    const userText = await transcribe(AUDIO_PATH, WHISPER_MODEL);
    console.log("you:", userText);
    if (!userText) return;
    const reply = await call(messages, userText);
    console.log("ai:", reply);
    await speak(reply);
  } catch (err) {
    console.error("hotkey error:", err);
  }
};

app.whenReady().then(() => {
  const ok = globalShortcut.register(
    "CommandOrControl+Shift+J",
    handleKeyPress,
  );
  if (!ok) {
    console.error("hotkey registration failed");
  }
  console.log("Electron ready. Press Cmd+Shift+J to talk.");
  if (process.platform === "darwin") {
    app.dock?.hide();
  }
});

app.on("will-quit", () => globalShortcut.unregisterAll());

app.on("window-all-closed", () => {
  // keep app alive even with no windows
});
