import { useEffect, useRef, useState } from "react";
import type { ConfirmRequest } from "../../preload.js";

const HOLD_MS = 1500;

export const ConfirmDialog = () => {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStart = useRef(0);

  useEffect(() => {
    return window.approval.onRequest((req) => {
      setRequest(req);
      setHoldProgress(0);
    });
  }, []);

  const clearHold = (): void => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setHoldProgress(0);
  };

  if (!request) return null;

  const respond = async (ok: boolean): Promise<void> => {
    clearHold();
    await window.approval.respond(request.id, ok);
    setRequest(null);
  };

  const isDanger = request.risk === "danger";

  const startHold = (): void => {
    if (!isDanger) return;
    holdStart.current = Date.now();
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - holdStart.current;
      const pct = Math.min(100, (elapsed / HOLD_MS) * 100);
      setHoldProgress(pct);
      if (elapsed >= HOLD_MS) {
        clearHold();
        void respond(true);
      }
    }, 30);
  };

  return (
    <div
      className={`confirm-backdrop ${isDanger ? "danger" : ""}`}
      onClick={() => void respond(false)}
    >
      <div
        className={`confirm-card ${isDanger ? "danger" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-label="Confirm action"
      >
        <div className="confirm-title">
          {isDanger ? "🛑 DANGER · DESTRUCTIVE ACTION" : "⚠️ Approval needed"}
        </div>
        {isDanger && (
          <div className="confirm-warning">
            This command may delete files, modify system state, or be
            irreversible. Hold the button below to confirm.
          </div>
        )}
        <pre className="confirm-question">{request.question}</pre>
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-btn deny"
            onClick={() => void respond(false)}
          >
            Deny
          </button>
          {isDanger ? (
            <button
              type="button"
              className="confirm-btn approve danger"
              onMouseDown={startHold}
              onMouseUp={clearHold}
              onMouseLeave={clearHold}
              onTouchStart={startHold}
              onTouchEnd={clearHold}
            >
              <span
                className="confirm-btn-fill"
                style={{ width: `${holdProgress}%` }}
                aria-hidden="true"
              />
              <span className="confirm-btn-label">
                {holdProgress === 0
                  ? "Hold to confirm"
                  : `Hold… ${Math.round(holdProgress)}%`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="confirm-btn approve"
              onClick={() => void respond(true)}
              autoFocus
            >
              Approve
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
