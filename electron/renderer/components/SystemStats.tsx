import { useEffect, useState } from "react";
import type { SystemStats as SystemStatsT } from "../../preload.js";

const formatGb = (bytes: number): string => (bytes / 1024 ** 3).toFixed(1);

export const SystemStats = () => {
  const [stats, setStats] = useState<SystemStatsT | null>(null);

  useEffect(() => {
    void window.system.stats().then(setStats);
    return window.system.onStats(setStats);
  }, []);

  if (!stats) return null;

  const cpuPct = Math.round(stats.cpu * 100);
  const memPct = Math.round(stats.memPercent * 100);
  const memUsedGb = formatGb(stats.memUsed);
  const memTotalGb = formatGb(stats.memTotal);

  return (
    <div className="sys-stats">
      <Stat
        label="CPU"
        percent={cpuPct}
        detail={`${cpuPct}%`}
        tone={cpuPct > 80 ? "high" : "normal"}
      />
      <Stat
        label="RAM"
        percent={memPct}
        detail={`${memUsedGb} / ${memTotalGb} GB`}
        tone={memPct > 85 ? "high" : "normal"}
      />
    </div>
  );
};

type StatProps = {
  label: string;
  percent: number;
  detail: string;
  tone: "normal" | "high";
};

const Stat = ({ label, percent, detail, tone }: StatProps) => (
  <div className="sys-stat" title={`${label}: ${detail}`}>
    <div className="sys-stat-row">
      <span className="sys-stat-label">{label}</span>
      <span className="sys-stat-detail">{detail}</span>
    </div>
    <div className="sys-stat-bar">
      <div
        className={`sys-stat-fill ${tone}`}
        style={{ width: `${Math.max(2, percent)}%` }}
      />
    </div>
  </div>
);
