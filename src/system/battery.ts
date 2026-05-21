import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type BatteryState = "charging" | "discharging" | "charged" | "unknown";

export type BatteryStatus = {
  percent: number;
  state: BatteryState;
};

const parseState = (raw: string): BatteryState => {
  const s = raw.toLowerCase();
  if (s.includes("charging") && !s.includes("not charging")) return "charging";
  if (s.includes("discharging")) return "discharging";
  if (s.includes("charged") || s.includes("ac attached") || s.includes("not charging"))
    return "charged";
  return "unknown";
};

export const getBatteryStatus = async (): Promise<BatteryStatus | null> => {
  try {
    const { stdout } = await execAsync("/usr/bin/pmset -g batt", {
      timeout: 2000,
    });
    const match = /(\d+)%;\s*([^;]+);/.exec(stdout);
    if (!match) return null;
    return {
      percent: Number(match[1]),
      state: parseState(match[2]),
    };
  } catch {
    return null;
  }
};
