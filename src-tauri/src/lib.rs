mod pty;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the main window when another instance tries to launch
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let app_state = AppState::new(app.handle().clone());
            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty::spawn_terminal,
            pty::write_to_terminal,
            pty::resize_terminal,
            pty::kill_terminal,
            state::get_instances,
            state::save_instances,
            state::load_instances,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
