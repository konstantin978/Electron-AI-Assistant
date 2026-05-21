#!/usr/bin/env node
/**
 * Dev orchestrator: spawn Vite, detect the port it actually bound to
 * (Vite auto-increments when 5173 is busy), then spawn Electron with
 * ELECTRON_DEV_URL pointing at the right URL.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const log = (tag, line) => process.stdout.write(`[${tag}] ${line}`);

const vite = spawn("npx", ["vite"], {
  cwd: projectRoot,
  stdio: ["inherit", "pipe", "pipe"],
});

let electronStarted = false;
let detectedUrl = null;

const tryStartElectron = (url) => {
  if (electronStarted) return;
  electronStarted = true;
  detectedUrl = url;
  log("dev", `vite ready at ${url}\n`);

  const tscOk = () => {
    log("dev", "starting electron…\n");
    const electron = spawn(
      "npx",
      ["electron", "dist/electron/main.js"],
      {
        cwd: projectRoot,
        stdio: "inherit",
        env: {
          ...process.env,
          ELECTRON_DEV: "1",
          ELECTRON_DEV_URL: url,
        },
      },
    );
    electron.on("exit", (code) => {
      log("dev", `electron exited ${code}\n`);
      vite.kill();
      process.exit(code ?? 0);
    });
  };

  log("dev", "building electron (tsc)…\n");
  const tsc = spawn("npx", ["tsc"], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  tsc.on("exit", (code) => {
    if (code === 0) tscOk();
    else {
      log("dev", `tsc failed (${code})\n`);
      vite.kill();
      process.exit(code ?? 1);
    }
  });
};

vite.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (!electronStarted) {
    const match = /Local:\s+(https?:\/\/localhost:\d+\/?)/.exec(text);
    if (match) tryStartElectron(match[1].replace(/\/$/, ""));
  }
});

vite.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

vite.on("exit", (code) => {
  log("dev", `vite exited ${code}\n`);
  process.exit(code ?? 0);
});

const shutdown = () => {
  vite.kill();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Surface the detected URL for debugging
process.on("beforeExit", () => {
  if (detectedUrl) log("dev", `last url ${detectedUrl}\n`);
});
