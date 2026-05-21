import { randomUUID } from "node:crypto";
import type { BrowserWindow } from "electron";
import { ask } from "../prompt.js";

const TIMEOUT_MS = 60_000;

export type ConfirmRisk = "normal" | "danger";

let confirmWindow: BrowserWindow | null = null;
const pending = new Map<string, (ok: boolean) => void>();

export const setConfirmWindow = (window: BrowserWindow | null): void => {
  confirmWindow = window;
};

export const resolveConfirmation = (id: string, ok: boolean): void => {
  const resolver = pending.get(id);
  if (resolver) {
    pending.delete(id);
    resolver(ok);
  }
};

export const confirmInUi = async (
  question: string,
  risk: ConfirmRisk = "normal",
): Promise<boolean> => {
  if (confirmWindow && !confirmWindow.isDestroyed()) {
    const id = randomUUID();
    return new Promise((resolve) => {
      pending.set(id, resolve);
      confirmWindow!.webContents.send("confirm:request", {
        id,
        question,
        risk,
      });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve(false);
        }
      }, TIMEOUT_MS);
    });
  }

  // CLI fallback
  const tag = risk === "danger" ? "⚠️  DANGER" : "⚠️  Approval";
  const answer = await ask(`${tag}\n${question}\nApprove? (y/N): `);
  return answer.toLowerCase() === "y";
};
