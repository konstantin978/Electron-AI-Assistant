import React, { useEffect, useState } from "react";
import type { BatteryStatus } from "../../preload.js";

export const BatteryIndicator = () => {
  const [battery, setBattery] = useState<BatteryStatus | null>(null);

  useEffect(() => {
    void window.system.battery().then(setBattery);
    return window.system.onBattery(setBattery);
  }, []);

  if (!battery) return null;

  const { percent, state } = battery;
  const isCharging = state === "charging" || state === "charged";
  const low = percent <= 20;
  const fillClass = low ? "low" : isCharging ? "charging" : "normal";

  return (
    <div
      className="battery"
      title={`${percent}% · ${state}`}
      aria-label={`Battery ${percent}% ${state}`}
    >
      <div className="battery-shell">
        <div
          className={`battery-fill ${fillClass}`}
          style={{ width: `${Math.max(8, percent)}%` }}
        />
        {isCharging && <span className="battery-bolt">⚡</span>}
      </div>
      <span className="battery-pct">{percent}%</span>
    </div>
  );
};
