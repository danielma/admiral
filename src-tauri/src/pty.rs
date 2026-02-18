use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::thread;
use tauri::{AppHandle, Emitter, State};

use crate::state::AppState;

struct PtyInstance {
    pair: PtyPair,
    writer: Box<dyn Write + Send>,
}

pub struct PtyManager {
    instances: Mutex<HashMap<String, PtyInstance>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            instances: Mutex::new(HashMap::new()),
        }
    }

    pub fn spawn(
        &self,
        id: String,
        cwd: String,
        command: Vec<String>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        // Get user's shell
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());

        // Build the command to run inside the shell
        // We explicitly cd to the directory first to ensure correct PWD
        let cmd_str = if command.is_empty() {
            // Just start an interactive shell in the directory
            format!("cd {} && exec $SHELL", shell_escape::escape(cwd.clone().into()))
        } else {
            // Run the command in the directory
            let escaped_cwd = shell_escape::escape(cwd.clone().into());
            let escaped_cmd = command.iter()
                .map(|s| shell_escape::escape(s.clone().into()).to_string())
                .collect::<Vec<_>>()
                .join(" ");
            format!("cd {} && exec {}", escaped_cwd, escaped_cmd)
        };

        let mut cmd = CommandBuilder::new(&shell);
        cmd.args(&["-c", &cmd_str]);
        cmd.cwd(&cwd); // Also set cwd as a fallback

        // Set some environment variables
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

        // Store the instance
        {
            let mut instances = self.instances.lock();
            instances.insert(
                id.clone(),
                PtyInstance {
                    pair,
                    writer,
                },
            );
        }

        // Spawn reader thread to forward PTY output to frontend
        let id_clone = id.clone();
        let app_handle_clone = app_handle.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_handle_clone.emit(&format!("pty-output-{}", id_clone), data);
                    }
                    Err(_) => break,
                }
            }
            // PTY closed, notify frontend
            let _ = app_handle_clone.emit(&format!("pty-exit-{}", id_clone), ());
        });

        // Spawn thread to wait for child exit
        let id_clone2 = id.clone();
        thread::spawn(move || {
            let _ = child.wait();
            let _ = app_handle.emit(&format!("pty-exit-{}", id_clone2), ());
        });

        Ok(())
    }

    pub fn write(&self, id: &str, data: &[u8]) -> Result<(), String> {
        let mut instances = self.instances.lock();
        if let Some(instance) = instances.get_mut(id) {
            instance
                .writer
                .write_all(data)
                .map_err(|e| e.to_string())?;
            instance.writer.flush().map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err(format!("Terminal {} not found", id))
        }
    }

    pub fn resize(&self, id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let instances = self.instances.lock();
        if let Some(instance) = instances.get(id) {
            instance
                .pair
                .master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err(format!("Terminal {} not found", id))
        }
    }

    pub fn kill(&self, id: &str) -> Result<(), String> {
        let mut instances = self.instances.lock();
        if instances.remove(id).is_some() {
            Ok(())
        } else {
            Err(format!("Terminal {} not found", id))
        }
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}

// Tauri commands

#[tauri::command]
pub async fn spawn_terminal(
    id: String,
    cwd: String,
    command: Vec<String>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    state.pty_manager.spawn(id, cwd, command, app_handle)
}

#[tauri::command]
pub async fn write_to_terminal(
    id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.pty_manager.write(&id, data.as_bytes())
}

#[tauri::command]
pub async fn resize_terminal(
    id: String,
    rows: u16,
    cols: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.pty_manager.resize(&id, rows, cols)
}

#[tauri::command]
pub async fn kill_terminal(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.pty_manager.kill(&id)
}
