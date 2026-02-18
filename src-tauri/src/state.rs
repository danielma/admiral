use crate::pty::PtyManager;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub cwd: String,
    pub status: InstanceStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum InstanceStatus {
    Idle,
    Working,
    Waiting,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedState {
    pub instances: Vec<Instance>,
}

pub struct AppState {
    pub pty_manager: PtyManager,
    app_handle: AppHandle,
}

impl AppState {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            pty_manager: PtyManager::new(),
            app_handle,
        }
    }

    fn get_state_path(&self) -> PathBuf {
        let app_data_dir = self
            .app_handle
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        app_data_dir.join("state.json")
    }
}

#[tauri::command]
pub async fn get_instances(state: State<'_, AppState>) -> Result<Vec<Instance>, String> {
    let path = state.get_state_path();
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let persisted: PersistedState = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(persisted.instances)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn save_instances(
    instances: Vec<Instance>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let path = state.get_state_path();

    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let persisted = PersistedState { instances };
    let content = serde_json::to_string_pretty(&persisted).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn load_instances(state: State<'_, AppState>) -> Result<Vec<Instance>, String> {
    get_instances(state).await
}
