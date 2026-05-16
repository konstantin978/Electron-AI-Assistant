# Jarvis-JS — Milestones

## What it does

- I press a hotkey
- It listens, transcribes my voice
- Sends to local LLM (Ollama) with tool list
- LLM responds or calls a tool (calendar, files, etc.)
- It speaks the answer

## Milestones (each one must be a working demo)

- [x] **M1** — Node script: text in → Ollama → text out
- [x] **M2** — Add 1 tool the LLM can call (e.g. "what time is it")
- [x] **M3** — Add TTS — output spoken aloud
- [ ] **M4** — Add Whisper — input via microphone
- [ ] **M5** — Wrap in Electron + global hotkey
- [ ] **M6** — Add 2–3 useful tools (calendar, file search, notes)

## Out of scope (do NOT build yet)

- Multi-user
- Cloud sync
- Settings UI
- Pretty UI of any kind

## Stack

- Node.js + JavaScript
- Ollama (local LLM, already installed)
- Electron (added at M5)
- Whisper (added at M4)
- Piper or `say` for TTS (added at M3)
