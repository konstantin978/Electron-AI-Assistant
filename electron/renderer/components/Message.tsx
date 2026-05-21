import React from "react";
import type { ChatMessage } from "../types.js";

type Props = {
  message: ChatMessage;
};

export const Message = ({ message }: Props) => {
  if (message.role === "user") {
    return <div className="message user">{message.content}</div>;
  }

  return (
    <div className="message ai">
      {message.toolCalls?.map((tc, i) => (
        <div className="tool-call" key={i}>
          ⚡ {tc.name}({tc.args ? JSON.stringify(tc.args) : ""})
        </div>
      ))}
      <div>{message.content}</div>
    </div>
  );
};
