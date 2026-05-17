import { createInterface } from "node:readline/promises";

export const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

export const ask = async (question: string): Promise<string> =>
  (await rl.question(question)).trim();
