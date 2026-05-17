import "dotenv/config";
import { statSync } from "node:fs";
import { call, type Message } from "./src/llm.js";
import { speak } from "./src/tts.js";
import { recordAudio, transcribe } from "./src/stt.js";
import { WHISPER_MODEL, AUDIO_PATH, SYSTEM_PROMPT } from "./src/config.js";
import { rl, ask } from "./src/prompt.js";
import { log } from "./src/utils/logger.js";

const TEXT_MODE = process.env.MODE === "text";
const MIN_AUDIO_BYTES = 10_000;
const EXIT_REGEX = /\b(exit|quit|stop|goodbye)\b/i;

const getInput = async (): Promise<string> => {
  if (TEXT_MODE) {
    return ask("\nyou: ");
  }

  log.info("\n🎤 listening (speak, then pause)...");
  await recordAudio(AUDIO_PATH);
  const size = statSync(AUDIO_PATH).size;
  log.info(`[debug] recorded ${size} bytes`);
  if (size < MIN_AUDIO_BYTES) {
    log.warn("audio too short, try again");
    return "";
  }
  return await transcribe(AUDIO_PATH, WHISPER_MODEL);
};

const main = async (): Promise<void> => {
  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

  while (true) {
    const userText = await getInput();
    if (!userText) continue;
    log.info(`you: ${userText}`);

    if (EXIT_REGEX.test(userText)) break;

    const reply = await call(messages, userText);
    log.info(`ai: ${reply}`);
    if (!TEXT_MODE) await speak(reply);
  }

  rl.close();
};

main().catch((err) => {
  log.error(`Fatal: ${(err as Error).message}`);
  process.exit(1);
});
