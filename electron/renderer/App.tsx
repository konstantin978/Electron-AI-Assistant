import React, { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "./components/Header.js";
import { HomeView } from "./components/HomeView.js";
import { HistoryView } from "./components/HistoryView.js";
import { ChatView } from "./components/ChatView.js";
import { chatStore } from "./store/chats.js";
import { aiStore } from "./store/ai.js";
import type { Chat, Status, View } from "./types.js";

const MODEL = "qwen2.5:7b";

const titleFromMessage = (text: string): string =>
  text.length > 40 ? `${text.slice(0, 37)}…` : text;

const App = () => {
  const [view, setView] = useState<View>({ kind: "home" });
  const [status, setStatus] = useState<Status>("idle");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const [draft, setDraft] = useState("");
  const activeChatIdRef = useRef<string | null>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    chatStore
      .list()
      .then((loaded) => {
        setChats(loaded);
        setDbReady(true);
      })
      .catch((err) => {
        console.error("Failed to load chats:", err);
        setDbReady(true);
      });
  }, []);

  const reloadChats = useCallback(async (): Promise<void> => {
    const fresh = await chatStore.list();
    setChats(fresh);
  }, []);

  // Core action: send text to LLM, persist, refresh.
  // Stays on the current view (no auto-switch to chat).
  const sendText = useCallback(
    async (text: string, spokenInput: boolean): Promise<void> => {
      let chatId = activeChatIdRef.current;

      // First message creates a new chat (still on home view)
      if (!chatId) {
        const now = Date.now();
        chatId = crypto.randomUUID();
        await chatStore.create({
          id: chatId,
          title: titleFromMessage(text),
          messages: [],
          createdAt: now,
          updatedAt: now,
        });
        setActiveChatId(chatId);
        activeChatIdRef.current = chatId;
      }

      setStatus("thinking");
      try {
        await reloadChats();
        // When input was spoken, main process streams sentence-by-sentence
        // speech in parallel with text streaming.
        if (spokenInput) setStatus("speaking");
        await aiStore.send(chatId, text, spokenInput);
        await reloadChats();
      } catch (err) {
        console.error("ai:send failed:", err);
      } finally {
        setStatus("idle");
      }
    },
    [reloadChats],
  );

  const handleSend = (text: string): void => {
    void sendText(text, false);
  };

  // Voice flow: listen → transcribe → send → speak
  const startListening = useCallback(async (): Promise<void> => {
    if (status === "listening" || status === "thinking") return;
    setStatus("listening");
    try {
      const transcript = await aiStore.listen();
      if (!transcript || transcript.trim().length === 0) {
        setStatus("idle");
        return;
      }
      await sendText(transcript, true);
    } catch (err) {
      console.error("ai:listen failed:", err);
      setStatus("idle");
    }
  }, [status, sendText]);

  const handleMic = (): void => {
    void startListening();
  };

  const handleOpenHistory = (): void => setView({ kind: "history" });

  const handleBack = (): void => {
    setView({ kind: "home" });
  };

  const handleOpenChat = (id: string): void => {
    setActiveChatId(id);
    setView({ kind: "chat", chatId: id });
  };

  const handleNewChat = (): void => {
    setActiveChatId(null);
    setView({ kind: "home" });
  };

  // Swap between home (mic) and the active chat
  const handleToggleChat = (): void => {
    if (view.kind === "chat") {
      setView({ kind: "home" });
    } else if (activeChatId) {
      setView({ kind: "chat", chatId: activeChatId });
    }
  };

  // ⌘⇧J inside window
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "j"
      ) {
        e.preventDefault();
        void startListening();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startListening]);

  // Global hotkey from main process (works even when window is unfocused)
  useEffect(() => {
    return aiStore.onHotkey(() => {
      void startListening();
    });
  }, [startListening]);

  // Subscribe to streaming token chunks from main
  useEffect(() => {
    const offChunk = aiStore.onChunk(({ chatId, content }) => {
      if (chatId === activeChatIdRef.current) {
        setDraft((prev) => prev + content);
      }
    });
    const offEnd = aiStore.onChunkEnd(() => {
      setDraft("");
    });
    return () => {
      offChunk();
      offEnd();
    };
  }, []);

  if (!dbReady) {
    return (
      <div className="window">
        <div className="drag-region" />
        <div className="empty-state" style={{ margin: "auto" }}>
          Connecting to MongoDB…
        </div>
      </div>
    );
  }

  return (
    <div className="window">
      <div className="drag-region" />
      <Header
        status={status}
        model={MODEL}
        view={view}
        hasActiveChat={!!activeChatId}
        onOpenHistory={handleOpenHistory}
        onNewChat={handleNewChat}
        onBack={handleBack}
        onToggleChat={handleToggleChat}
      />

      {view.kind === "home" && (
        <HomeView status={status} onMic={handleMic} onSend={handleSend} />
      )}

      {view.kind === "history" && (
        <HistoryView chats={chats} onOpenChat={handleOpenChat} />
      )}

      {view.kind === "chat" && activeChat && (
        <ChatView
          chat={activeChat}
          status={status}
          draft={draft}
          onSend={handleSend}
        />
      )}
    </div>
  );
};

export default App;
