import { useState, type KeyboardEvent } from "react";
import type { Status } from "../types.js";

type Props = {
  status: Status;
  onSend: (text: string) => void;
};

export const InputRow = ({ status, onSend }: Props) => {
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
    <div className="input-row">
      <input
        className="input-field"
        type="text"
        placeholder="Type a message…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
      />
    </div>
  );
};
