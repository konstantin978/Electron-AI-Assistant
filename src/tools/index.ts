import type { Tool, ToolDef, ToolFn } from "./types.js";
import { tools as timeTools } from "./time.js";
import { tools as fileTools } from "./files.js";
import { tools as shellTools } from "./shell.js";
import { tools as screenshotTools } from "./screenshot.js";
import { tools as notificationTools } from "./notifications.js";
import { tools as appTools } from "./apps.js";
import { tools as clipboardTools } from "./clipboard.js";

const allTools: Tool[] = [
  ...timeTools,
  ...fileTools,
  ...shellTools,
  ...screenshotTools,
  ...notificationTools,
  ...appTools,
  ...clipboardTools,
];

export const toolDefs: ToolDef[] = allTools.map((t) => t.def);

export const toolFns: Record<string, ToolFn> = Object.fromEntries(
  allTools.map((t) => [t.def.function.name, t.fn]),
);

export type { Tool, ToolDef, ToolFn } from "./types.js";
