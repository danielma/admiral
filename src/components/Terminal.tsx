import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import { InstanceStatus } from "../types";

interface TerminalProps {
  instanceId: string;
  isActive: boolean;
  onStatusChange: (status: InstanceStatus) => void;
  onExit: () => void;
}

export function Terminal({
  instanceId,
  isActive,
  onStatusChange,
  onExit,
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const listenersRef = useRef<UnlistenFn[]>([]);

  const parseOsc777 = useCallback(
    (data: string): void => {
      // OSC 777 format from Claude Code: notify;title;message
      // or just: notify;message
      const parts = data.split(";");
      if (parts.length >= 1) {
        const type = parts[0];
        if (type === "notify") {
          // Claude is waiting for input
          onStatusChange("waiting");
        }
      }
    },
    [onStatusChange]
  );

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new XTerm({
      theme: {
        background: "#1a1a1a",
        foreground: "#ffffff",
        cursor: "#ffffff",
        cursorAccent: "#1a1a1a",
        selectionBackground: "#7c3aed50",
        black: "#000000",
        red: "#ff5555",
        green: "#50fa7b",
        yellow: "#f1fa8c",
        blue: "#bd93f9",
        magenta: "#ff79c6",
        cyan: "#8be9fd",
        white: "#f8f8f2",
        brightBlack: "#6272a4",
        brightRed: "#ff6e6e",
        brightGreen: "#69ff94",
        brightYellow: "#ffffa5",
        brightBlue: "#d6acff",
        brightMagenta: "#ff92df",
        brightCyan: "#a4ffff",
        brightWhite: "#ffffff",
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Register OSC 777 handler
    term.parser.registerOscHandler(777, (data) => {
      parseOsc777(data);
      return true; // Consume the sequence (don't display)
    });

    term.open(terminalRef.current);

    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle terminal input -> send to PTY
    const disposeOnData = term.onData(async (data) => {
      try {
        await invoke("write_to_terminal", { id: instanceId, data });
        // User is typing, Claude is working
        onStatusChange("working");
      } catch (e) {
        console.error("Failed to write to terminal:", e);
      }
    });

    // Listen for PTY output
    const setupListeners = async () => {
      const outputUnlisten = await listen<string>(
        `pty-output-${instanceId}`,
        (event) => {
          term.write(event.payload);
        }
      );

      const exitUnlisten = await listen(`pty-exit-${instanceId}`, () => {
        term.write("\r\n\x1b[90m[Process exited]\x1b[0m\r\n");
        onExit();
      });

      listenersRef.current = [outputUnlisten, exitUnlisten];
    };

    setupListeners();

    // Resize handler
    const handleResize = () => {
      if (fitAddonRef.current && isActive) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          invoke("resize_terminal", {
            id: instanceId,
            rows: dims.rows,
            cols: dims.cols,
          }).catch(console.error);
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);

    return () => {
      disposeOnData.dispose();
      listenersRef.current.forEach((unlisten) => unlisten());
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [instanceId, parseOsc777, onStatusChange, onExit]);

  // Fit terminal when it becomes active
  useEffect(() => {
    if (isActive && fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
        const dims = fitAddonRef.current?.proposeDimensions();
        if (dims) {
          invoke("resize_terminal", {
            id: instanceId,
            rows: dims.rows,
            cols: dims.cols,
          }).catch(console.error);
        }
      }, 0);
    }
  }, [isActive, instanceId]);

  return (
    <div
      ref={terminalRef}
      className={`terminal-wrapper ${isActive ? "active" : ""}`}
      style={{ height: "100%", width: "100%" }}
    />
  );
}
