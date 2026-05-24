import type { Status, View } from "../types.js";
import {
  HistoryIcon,
  BackIcon,
  NewChatIcon,
  ChatBubbleIcon,
  HomeIcon,
  ActivityIcon,
  LoopIcon,
} from "./icons.js";

type Props = {
  status: Status;
  model: string;
  view: View;
  hasActiveChat: boolean;
  conversationMode: boolean;
  onOpenHistory: () => void;
  onNewChat: () => void;
  onBack: () => void;
  onToggleChat: () => void;
  onOpenProcesses: () => void;
  onToggleConversationMode: () => void;
};

const STATUS_LABELS: Record<Status, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export const Header = ({
  status,
  model,
  view,
  hasActiveChat,
  conversationMode,
  onOpenHistory,
  onNewChat,
  onBack,
  onToggleChat,
  onOpenProcesses,
  onToggleConversationMode,
}: Props) => {
  const isIdle = status === "idle";
  const isHome = view.kind === "home";
  const isHistory = view.kind === "history";
  const isChat = view.kind === "chat";

  return (
    <header className="header">
      {isHistory && (
        <button
          className="icon-btn"
          type="button"
          onClick={onBack}
          title="Back"
          aria-label="Back"
        >
          <BackIcon />
        </button>
      )}

      {(isHome || isChat) && (
        <>
          <div
            className={`status-dot ${isIdle ? "idle" : "pulse"}`}
            aria-label={`Status: ${status}`}
          />
          <div className="status-info">
            <div className={`status-text ${isIdle ? "idle" : ""}`}>
              {STATUS_LABELS[status]}
            </div>
            <div className="model-name">{model} · local</div>
          </div>
        </>
      )}

      {isHistory && (
        <div className="status-info">
          <div className="status-text idle">Chats</div>
        </div>
      )}

      <div className="header-actions">
        {isHistory && (
          <button
            className="icon-btn"
            type="button"
            onClick={onNewChat}
            title="New chat"
            aria-label="New chat"
          >
            <NewChatIcon />
          </button>
        )}

        {/* Swap between home (mic) and the current chat thread */}
        {(isHome || isChat) && hasActiveChat && (
          <button
            className="icon-btn"
            type="button"
            onClick={onToggleChat}
            title={isHome ? "View current chat" : "Back to mic"}
            aria-label={isHome ? "View current chat" : "Back to mic"}
          >
            {isHome ? <ChatBubbleIcon /> : <HomeIcon />}
          </button>
        )}

        {isHome && (
          <button
            className="icon-btn"
            type="button"
            onClick={onOpenHistory}
            title="Chat history"
            aria-label="Chat history"
          >
            <HistoryIcon />
          </button>
        )}

        <button
          className={`icon-btn ${conversationMode ? "active" : ""}`}
          type="button"
          onClick={onToggleConversationMode}
          title={
            conversationMode
              ? "Conversation mode ON — auto-listens after each reply"
              : "Conversation mode OFF — press mic each time"
          }
          aria-label="Toggle conversation mode"
          aria-pressed={conversationMode}
        >
          <LoopIcon />
        </button>

        <button
          className="icon-btn"
          type="button"
          onClick={onOpenProcesses}
          title="System activity"
          aria-label="System activity"
        >
          <ActivityIcon />
        </button>
      </div>
    </header>
  );
};
