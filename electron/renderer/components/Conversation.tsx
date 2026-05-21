import React, { useEffect, useMemo, useRef } from "react";
import { Message } from "./Message.js";
import { TypingIndicator } from "./TypingIndicator.js";
import type { ChatMessage, Status, ToolCall } from "../types.js";

type Props = {
  messages: ChatMessage[];
  status: Status;
  draft?: string;
};

const buildDisplayMessages = (messages: ChatMessage[]): ChatMessage[] => {
  const out: ChatMessage[] = [];
  let pendingTools: ToolCall[] = [];

  const flushPending = (): void => {
    if (pendingTools.length === 0) return;
    out.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      toolCalls: pendingTools,
      createdAt: Date.now(),
    });
    pendingTools = [];
  };

  for (const m of messages) {
    if (m.role === "tool") continue;

    if (m.role === "user") {
      flushPending();
      out.push(m);
      continue;
    }

    if (m.role === "assistant") {
      if (m.toolCalls && m.toolCalls.length > 0) {
        pendingTools.push(...m.toolCalls);
      }
      if (m.content && m.content.trim()) {
        out.push({
          ...m,
          toolCalls: pendingTools.length > 0 ? pendingTools : m.toolCalls,
        });
        pendingTools = [];
      }
    }
  }

  flushPending();
  return out;
};

export const Conversation = ({ messages, status, draft }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const display = useMemo(() => buildDisplayMessages(messages), [messages]);
  const hasDraft = draft != null && draft.length > 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [display, status, draft]);

  if (display.length === 0 && !hasDraft && status === "idle") {
    return (
      <div className="conversation" ref={scrollRef}>
        <div className="empty-state">
          Ready
          <div className="empty-state-hint">
            Press ⌘⇧J or type below to start
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation" ref={scrollRef}>
      {display.map((m) => (
        <Message message={m} key={m.id} />
      ))}
      {hasDraft && (
        <div className="message ai streaming">
          {draft}
          <span className="streaming-cursor" />
        </div>
      )}
      {status === "thinking" && !hasDraft && <TypingIndicator />}
    </div>
  );
};
