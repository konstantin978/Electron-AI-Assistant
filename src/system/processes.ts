import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type ProcessInfo = {
  pid: number;
  cpu: number;
  mem: number;
  command: string;
};

const PS_REGEX = /^\s*(\d+)\s+([\d.]+)\s+([\d.]+)\s+(.+?)\s*$/;

const prettyCommand = (raw: string): string => {
  // ps comm column gives the full path of the executable — trim to basename
  // but keep meaningful suffixes like " Helper" for Electron-style processes
  const trimmed = raw.trim();
  const lastSlash = trimmed.lastIndexOf("/");
  return lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
};

export const listProcesses = async (limit = 15): Promise<ProcessInfo[]> => {
  try {
    const { stdout } = await execAsync(
      "/bin/ps -A -o pid=,pcpu=,pmem=,comm=",
      { maxBuffer: 1_000_000, timeout: 3_000 },
    );

    const procs: ProcessInfo[] = [];
    for (const line of stdout.split("\n")) {
      const match = PS_REGEX.exec(line);
      if (!match) continue;
      procs.push({
        pid: Number(match[1]),
        cpu: Number(match[2]),
        mem: Number(match[3]),
        command: prettyCommand(match[4]),
      });
    }

    procs.sort((a, b) => b.cpu - a.cpu);
    return procs.slice(0, limit);
  } catch {
    return [];
  }
};

export const countProcessesAndThreads = async (): Promise<{
  processes: number;
  threads: number;
}> => {
  try {
    const [{ stdout: psOut }, { stdout: sysctlOut }] = await Promise.all([
      execAsync("/bin/ps -A -o pid= | wc -l", { timeout: 2_000 }),
      execAsync("/usr/sbin/sysctl -n kern.num_taskthreads", { timeout: 2_000 }),
    ]);
    return {
      processes: Number(psOut.trim()),
      threads: Number(sysctlOut.trim()),
    };
  } catch {
    return { processes: 0, threads: 0 };
  }
};
