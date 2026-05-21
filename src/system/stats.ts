import os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type SystemStats = {
  cpu: number; // 0..1
  memUsed: number; // bytes — matches Activity Monitor "Memory Used"
  memTotal: number; // bytes
  memPercent: number; // 0..1
};

let lastCpus: os.CpuInfo[] = os.cpus();

const sumTimes = (times: os.CpuInfo["times"]): number =>
  times.user + times.nice + times.sys + times.idle + times.irq;

const getCpuPercent = (): number => {
  const current = os.cpus();
  let idleDelta = 0;
  let totalDelta = 0;
  for (let i = 0; i < current.length; i++) {
    const cur = current[i];
    const last = lastCpus[i];
    if (!last) continue;
    idleDelta += cur.times.idle - last.times.idle;
    totalDelta += sumTimes(cur.times) - sumTimes(last.times);
  }
  lastCpus = current;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - idleDelta / totalDelta));
};

/**
 * Parse `vm_stat` to compute "Memory Used" the way Activity Monitor shows it:
 *   used = (active + wired + compressor-occupied) * pageSize
 *
 * This excludes file cache (which is reclaimable) so the number doesn't
 * pin at 31/32 GB just because macOS aggressively caches files.
 */
const getMacMemoryUsed = async (): Promise<number | null> => {
  try {
    const { stdout } = await execAsync("/usr/bin/vm_stat", { timeout: 2_000 });
    const pageMatch = /page size of (\d+) bytes/.exec(stdout);
    const pageSize = pageMatch ? Number(pageMatch[1]) : 4096;

    const pages = (key: string): number => {
      const re = new RegExp(`${key}:\\s+(\\d+)\\.?`);
      const m = re.exec(stdout);
      return m ? Number(m[1]) : 0;
    };

    const active = pages("Pages active");
    const wired = pages("Pages wired down");
    const compressed = pages("Pages occupied by compressor");

    return (active + wired + compressed) * pageSize;
  } catch {
    return null;
  }
};

export const getSystemStats = async (): Promise<SystemStats> => {
  const cpu = getCpuPercent();
  const memTotal = os.totalmem();

  let memUsed: number;
  if (process.platform === "darwin") {
    const mac = await getMacMemoryUsed();
    memUsed = mac ?? memTotal - os.freemem();
  } else {
    memUsed = memTotal - os.freemem();
  }

  return {
    cpu,
    memUsed,
    memTotal,
    memPercent: Math.max(0, Math.min(1, memUsed / memTotal)),
  };
};
