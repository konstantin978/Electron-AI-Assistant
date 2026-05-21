import { collection } from "./index.js";
import type { Chat, ChatMessage } from "./types.js";

const CHATS = "chats";

const chatsCollection = () => collection<Chat>(CHATS);

export const listChats = async (): Promise<Chat[]> => {
  return chatsCollection().find({}).sort({ updatedAt: -1 }).toArray();
};

export const getChat = async (id: string): Promise<Chat | null> => {
  return chatsCollection().findOne({ id });
};

export const createChat = async (chat: Chat): Promise<void> => {
  await chatsCollection().insertOne(chat);
};

export const appendMessage = async (
  chatId: string,
  message: ChatMessage,
): Promise<void> => {
  await chatsCollection().updateOne(
    { id: chatId },
    {
      $push: { messages: message },
      $set: { updatedAt: Date.now() },
    },
  );
};

export const updateTitle = async (
  chatId: string,
  title: string,
): Promise<void> => {
  await chatsCollection().updateOne(
    { id: chatId },
    { $set: { title, updatedAt: Date.now() } },
  );
};

export const deleteChat = async (chatId: string): Promise<void> => {
  await chatsCollection().deleteOne({ id: chatId });
};
