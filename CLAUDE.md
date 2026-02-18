# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-Claude is a Tauri desktop app for running multiple Claude Code instances with status tracking and system notifications. It uses React + TypeScript for the frontend and Rust for the backend.

## Development Commands

```bash
npm install              # Install Node dependencies
npm run tauri dev        # Start dev mode (Vite + Tauri backend with hot-reload)
npm run tauri build      # Build production app
npm run build            # Build frontend only (tsc + vite build)
```

## Architecture

**Frontend (React + TypeScript):**
- `src/App.tsx` - Main orchestrator: instance state, keyboard shortcuts (Cmd+N, Cmd+1-9), notification triggers
- `src/components/Terminal.tsx` - xterm.js wrapper that parses OSC 777 sequences to detect Claude's "waiting" status
- `src/components/Sidebar.tsx` - Instance list with status indicators
- `src/components/AddInstance.tsx` - Directory picker modal

**Backend (Rust/Tauri):**
- `src-tauri/src/lib.rs` - Tauri setup, command handlers
- `src-tauri/src/pty.rs` - PTY management: spawning, I/O, resize. Uses `portable-pty` crate
- `src-tauri/src/state.rs` - JSON persistence for instance metadata

**Communication:**
- Frontend → Backend: `invoke()` for commands (`spawn_terminal`, `write_to_terminal`, `resize_terminal`, `kill_terminal`)
- Backend → Frontend: Events (`pty-output-{id}`, `pty-exit-{id}`) for real-time terminal output

**Status Detection:** Terminal component intercepts OSC 777 escape sequences from Claude CLI output to determine working/waiting/idle states.

## Key Dependencies

- `@tauri-apps/api` - IPC, dialogs, notifications
- `xterm` + addons - Terminal UI
- `portable-pty` - Cross-platform PTY
- `tokio` - Async Rust runtime
