# Electron AI Assistant

A local-first voice AI assistant for macOS. Runs entirely on your machine — no data leaves the device.

- **Listens** via [Whisper](https://github.com/ggerganov/whisper.cpp) (local speech-to-text)
- **Thinks** via [Ollama](https://ollama.com) (local LLM, e.g. `llama3.2:3b`)
- **Speaks** via macOS built-in `say`
- **Acts** through tools: filesystem, shell, clipboard, screenshots, notifications, app launching, music control

## Requirements

- macOS (Apple Silicon recommended)
- Node.js ≥ 22
- [Ollama](https://ollama.com) installed and running (`ollama serve`)
- `sox` for microphone capture: `brew install sox`
- `whisper.cpp` for transcription: `brew install whisper-cpp`
- A Whisper model file (e.g. `ggml-base.en.bin`) in `./models/`

## Setup

```bash
npm install
ollama pull llama3.2:3b
mkdir -p models && curl -L -o models/ggml-base.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
cp .env.example .env
```

## Run

### CLI (voice mode)
```bash
npm start
```

### CLI (text mode — for development)
```bash
npm run start:text
```

### Electron (global hotkey: `⌘⇧J`)
```bash
npm run electron
```

## Commands

| Script | What it does |
|---|---|
| `npm start` | Run the CLI in voice mode |
| `npm run start:text` | Run the CLI in text mode (type instead of speak) |
| `npm run electron` | Build and launch the Electron background app |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Lint with ESLint |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting without changes |

## Architecture

```
electron-ai-assistant/
├── electron/main.ts       # Electron entry: global hotkey, background app
├── index.ts               # CLI entry: text/voice loop
├── src/
│   ├── config.ts          # Constants (model, URLs, prompts)
│   ├── llm.ts             # Ollama call + tool dispatch
│   ├── prompt.ts          # Shared readline interface
│   ├── stt.ts             # Speech-to-text (sox + whisper-cpp)
│   ├── tts.ts             # Text-to-speech (macOS `say`)
│   ├── tools/
│   │   ├── index.ts       # Tool registry — aggregates all tools
│   │   ├── types.ts       # Tool / ToolDef / ToolFn types
│   │   ├── time.ts        # get_current_time
│   │   ├── files.ts       # read_file, list_directory
│   │   ├── shell.ts       # run_shell (with confirmation)
│   │   ├── screenshot.ts  # take_screenshot
│   │   ├── notifications.ts # send_notification, set_timer
│   │   ├── apps.ts        # open_app, control_music
│   │   └── clipboard.ts   # get_clipboard, set_clipboard
│   └── utils/
│       ├── logger.ts      # Structured console logging
│       ├── notifier.ts    # macOS notification helper
│       └── path.ts        # Path expansion (~)
└── models/                # Whisper model files (gitignored)
```

## Adding a tool

1. Create `src/tools/my_tool.ts` exporting `tools: Tool[]`.
2. Register it in `src/tools/index.ts` by adding to the `allTools` array.

A `Tool` is a `{ def, fn }` pair:

- `def` — the JSON Schema that the model sees (name, description, parameters).
- `fn` — the implementation that receives `args` and returns a `string` or `Promise<string>` for the model to read.

That's it — no other file needs to change.

## Environment variables

| Variable | Purpose |
|---|---|
| `MODE` | Set to `text` to disable voice and use stdin (development). |

## Tool list

| Tool | Description |
|---|---|
| `get_current_time` | Current time as ISO 8601 |
| `read_file` | Read a text file (50KB max) |
| `list_directory` | List directory contents |
| `run_shell` | Execute a shell command (asks for confirmation) |
| `take_screenshot` | Capture screen to PNG |
| `send_notification` | Show a macOS notification |
| `set_timer` | Schedule a notification after N seconds |
| `open_app` | Open a macOS app by name |
| `control_music` | Play/pause/skip in Spotify or Apple Music |
| `get_clipboard` | Read clipboard text |
| `set_clipboard` | Write to clipboard |

## License

MIT
