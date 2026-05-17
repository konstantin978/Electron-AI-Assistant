import "dotenv/config";
import { statSync } from "node:fs";
import { call, type Message } from "./src/llm.js";
import { speak } from "./src/tts.js";
import { recordAudio, transcribe } from "./src/stt.js";
import { WHISPER_MODEL, AUDIO_PATH, SYSTEM_PROMPT } from "./src/config.js";
import { rl, ask } from "./src/prompt.js";

const TEXT_MODE = process.env.MODE === "text";

const getInput = async (): Promise<string> => {
  if (TEXT_MODE) {
    return ask("\nyou: ");
  }

  console.log("\n🎤 listening (speak, then pause)...");
  await recordAudio(AUDIO_PATH);
  const size = statSync(AUDIO_PATH).size;
  console.log(`[debug] recorded ${size} bytes`);
  if (size < 10000) {
    console.log("audio too short, try again");
    return "";
  }
  return await transcribe(AUDIO_PATH, WHISPER_MODEL);
};

const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

while (true) {
  const userText = await getInput();
  if (!userText) continue;
  console.log("you:", userText);

  if (/\b(exit|quit|stop|goodbye)\b/i.test(userText)) break;

  const reply = await call(messages, userText);
  console.log("ai:", reply);
  if (!TEXT_MODE) await speak(reply);
}

rl.close();
