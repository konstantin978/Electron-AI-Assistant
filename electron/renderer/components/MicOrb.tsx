import { MicIcon } from "./icons.js";
import type { Status } from "../types.js";

type Props = {
  status: Status;
  onClick: () => void;
};

const HINT_BY_STATUS: Record<Status, string> = {
  idle: "Tap or press ⌘⇧J",
  listening: "Listening — tap to stop",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

export const MicOrb = ({ status, onClick }: Props) => {
  return (
    <div className={`mic-orb-wrap status-${status}`}>
      <button
        type="button"
        className={`mic-orb ${status}`}
        onClick={onClick}
        aria-label={status === "listening" ? "Stop listening" : "Start listening"}
      >
        <span className="mic-orb-halo" aria-hidden="true" />
        <span className="mic-orb-ring r1" aria-hidden="true" />
        <span className="mic-orb-ring r2" aria-hidden="true" />
        <span className="mic-orb-ring r3" aria-hidden="true" />
        <span className="mic-orb-core">
          <MicIcon />
        </span>
        <span className="mic-orb-bars" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
      </button>
      <div className="mic-orb-hint">{HINT_BY_STATUS[status]}</div>
    </div>
  );
};
