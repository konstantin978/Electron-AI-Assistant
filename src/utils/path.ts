import { homedir } from "node:os";

export const expandPath = (p: string): string =>
  p.startsWith("~/") ? p.replace("~", homedir()) : p;
