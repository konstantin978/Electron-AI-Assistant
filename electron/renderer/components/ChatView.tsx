import type { Chat, Status } from "../types.js";
import { Conversation } from "./Conversation.js";
import { InputRow } from "./InputRow.js";

type Props = {
  chat: Chat;
  status: Status;
  draft: string;
  onSend: (text: string) => void;
};

export const ChatView = ({ chat, status, draft, onSend }: Props) => {
  return (
    <div className="chat-view">
      <Conversation messages={chat.messages} status={status} draft={draft} />
      <InputRow status={status} onSend={onSend} />
    </div>
  );
};
