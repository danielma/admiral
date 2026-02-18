# Multi-Claude

A Tauri app for running multiple Claude Code instances with status tracking and notifications.

## Features

- **Multiple Claude Instances**: Run Claude Code in multiple project directories simultaneously
- **Status Tracking**: See at a glance which instances are working, waiting for input, or idle
- **System Notifications**: Get notified when any Claude instance needs your attention
- **Terminal Emulation**: Full xterm.js terminal with colors, scrollback, and web links
- **Keyboard Shortcuts**: Quick switching between instances with `Cmd+1-9`, add new with `Cmd+N`
- **State Persistence**: Instance list is saved and restored between app launches

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri App                                 │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + xterm.js)                                │
│  ┌──────────────┐  ┌──────────────────────────────────┐    │
│  │ Sidebar      │  │ Terminal Area                    │    │
│  │ - Instance 1 │  │ xterm.js instance for selected   │    │
│  │ - Instance 2 │  │ terminal                         │    │
│  │ - [+] Add    │  │                                  │    │
│  └──────────────┘  └──────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Rust Backend                                               │
│  - PTY management (portable-pty)                            │
│  - State persistence                                        │
│  - System notifications                                     │
└─────────────────────────────────────────────────────────────┘
```

## Development

### Prerequisites

- Node.js 18+
- Rust 1.70+
- Tauri CLI (`npm install -g @tauri-apps/cli`)

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Usage

1. Launch the app
2. Click "Add Instance" or press `Cmd+N`
3. Select a project directory and give it a name
4. Claude Code will start automatically in that directory
5. Switch between instances using the sidebar or `Cmd+1-9`
6. You'll receive system notifications when Claude needs input

## Status Indicators

- **Gray** (Idle): Claude has finished or is waiting to start
- **Blue** (Working): Claude is actively processing
- **Yellow** (Waiting): Claude needs your input (triggers notification)
- **Red** (Error): Something went wrong

## Tech Stack

- **Tauri 2** - Rust backend, native app with small binary size
- **React + TypeScript** - Frontend UI
- **xterm.js** - Terminal emulation with OSC 777 interception
- **portable-pty** - Cross-platform PTY handling in Rust
