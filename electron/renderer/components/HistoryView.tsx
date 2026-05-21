import React from "react";
import type { Chat } from "../types.js";

type Props = {
  chats: Chat[];
  onOpenChat: (id: string) => void;
};

const formatTime = (ts: number): string => {
  const date = new Date(ts);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const previewOf = (chat: Chat): string => {
  const lastAi = [...chat.messages]
    .reverse()
    .find((m) => m.role === "assistant");
  return lastAi?.content ?? "Empty chat";
};

export const HistoryView = ({ chats, onOpenChat }: Props) => {
  if (chats.length === 0) {
    return (
      <div className="history-view">
        <div className="empty-state">
          No chats yet
          <div className="empty-state-hint">Press the mic to start one</div>
        </div>
      </div>
    );
  }

  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="history-view">
      <ul className="chat-list">
        {sorted.map((chat) => (
          <li key={chat.id}>
            <button
              type="button"
              className="chat-item"
              onClick={() => onOpenChat(chat.id)}
            >
              <div className="chat-item-row">
                <span className="chat-item-title">{chat.title}</span>
                <span className="chat-item-time">
                  {formatTime(chat.updatedAt)}
                </span>
              </div>
              <div className="chat-item-preview">{previewOf(chat)}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
