# Electron AI Assistant — Milestones

## What it does

- I press a hotkey
- It listens, transcribes my voice
- Sends to local LLM (Ollama) with tool list
- LLM responds or calls a tool (filesystem, shell, screenshots, etc.)
- It speaks the answer

## Milestones (each one must be a working demo)

- [x] **M1** — Node script: text in → Ollama → text out
- [x] **M2** — Add 1 tool the LLM can call (e.g. "what time is it")
- [x] **M3** — Add TTS — output spoken aloud
- [x] **M4** — Add Whisper — input via microphone
- [x] **M5** — Wrap in Electron + global hotkey
- [x] **M6** — Add real tools (read_file, list_directory, run_shell, take_screenshot, send_notification, set_timer, open_app, control_music, get/set_clipboard)
- [ ] **M7** — UI: React + Vite renderer, menu bar popover, text input
- [ ] **M8** — Persistence: save chat history, restore on restart

## Out of scope (do NOT build yet)

- Multi-user
- Cloud sync
- Settings UI
- Themes

## Stack

- Node.js + TypeScript
- Ollama (local LLM)
- Whisper.cpp (local STT)
- macOS `say` (TTS)
- Electron + React + Vite (UI)
