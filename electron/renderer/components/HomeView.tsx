import { useState, type KeyboardEvent } from "react";
import type { Status } from "../types.js";
import { MicOrb } from "./MicOrb.js";

type Props = {
  status: Status;
  wakeFlash?: boolean;
  partialTranscript?: string;
  onMic: () => void;
  onSend: (text: string) => void;
};

export const HomeView = ({
  status,
  wakeFlash,
  partialTranscript,
  onMic,
  onSend,
}: Props) => {
  const [draft, setDraft] = useState("");
  const disabled = status === "thinking";

  const submit = (): void => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
    setDraft("");
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={`home-view ${wakeFlash ? "wake-flash" : ""}`}>
      <div className="home-center">
        <MicOrb
          status={status}
          partialText={partialTranscript}
          onClick={onMic}
        />
      </div>
      <div className="input-row">
        <input
          className="input-field"
          type="text"
          placeholder="Or type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
        />
      </div>
    </div>
  );
};
