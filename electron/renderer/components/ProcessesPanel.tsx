import { useEffect, useState } from "react";
import type { ProcessCounts, ProcessInfo } from "../../preload.js";

const POLL_MS = 3_000;

type Props = {
  onClose: () => void;
};

export const ProcessesPanel = ({ onClose }: Props) => {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [counts, setCounts] = useState<ProcessCounts>({
    processes: 0,
    threads: 0,
  });

  useEffect(() => {
    let alive = true;

    const tick = async (): Promise<void> => {
      const [procs, c] = await Promise.all([
        window.system.processes(),
        window.system.counts(),
      ]);
      if (!alive) return;
      setProcesses(procs);
      setCounts(c);
    };

    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="proc-backdrop" onClick={onClose}>
      <div
        className="proc-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Top processes"
      >
        <div className="proc-header">
          <div className="proc-title">Top processes</div>
          <div className="proc-counts">
            {counts.processes} procs · {counts.threads} threads
          </div>
          <button
            type="button"
            className="proc-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="proc-table-head">
          <div className="proc-col-pid">PID</div>
          <div className="proc-col-cpu">CPU</div>
          <div className="proc-col-mem">RAM</div>
          <div className="proc-col-name">Process</div>
        </div>
        <div className="proc-list">
          {processes.length === 0 && (
            <div className="proc-empty">Loading…</div>
          )}
          {processes.map((p) => (
            <div className="proc-row" key={p.pid}>
              <div className="proc-col-pid">{p.pid}</div>
              <div className="proc-col-cpu">{p.cpu.toFixed(1)}%</div>
              <div className="proc-col-mem">{p.mem.toFixed(1)}%</div>
              <div className="proc-col-name" title={p.command}>
                {p.command}
              </div>
            </div>
          ))}
        </div>

        <div className="proc-footer">Updates every 3s</div>
      </div>
    </div>
  );
};
