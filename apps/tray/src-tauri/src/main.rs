#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod state;
mod sync;

use state::AppState;
use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
};

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Show Status"))
        .add_item(CustomMenuItem::new("sync", "Sync Now"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "Quit"));

    let system_tray = SystemTray::new().with_menu(tray_menu);

    let app_state = AppState::new();

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(window) = app.get_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "sync" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let state = app_handle.state::<AppState>();
                        match commands::sync_now(state).await {
                            Ok(()) => println!("[LFC] Tray sync complete"),
                            Err(e) => println!("[LFC] Tray sync error: {}", e),
                        }
                    });
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .on_window_event(|event| {
            // Hide instead of close when the user clicks the X button
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                event.window().hide().unwrap();
                api.prevent_close();
            }
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::login,
            commands::logout,
            commands::get_status,
            commands::sync_now,
            commands::get_settings,
            commands::save_settings,
            commands::detect_local_configs,
            commands::scan_tools,
            commands::submit_suggestion,
            commands::get_my_suggestions,
            commands::get_profiles,
            commands::upload_snapshot,
        ])
        .setup(|app| {
            // Show the window on launch so the user knows the app started
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            // Start background sync loop — waits for the full interval before first sync
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                loop {
                    let (interval, should_sync) = {
                        let state = app_handle.state::<AppState>();
                        let config = state.config.lock().unwrap();
                        let interval = config.sync_interval;
                        let should_sync = config.auth_token.is_some();
                        (interval, should_sync)
                    };

                    // Sleep first — don't sync immediately on launch
                    tokio::time::sleep(tokio::time::Duration::from_secs(interval)).await;

                    if should_sync {
                        let state = app_handle.state::<AppState>();
                        match commands::sync_now(state).await {
                            Ok(()) => {}
                            Err(e) => println!("[LFC] Background sync error: {}", e),
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
