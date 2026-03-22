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
#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;

fn main() {
    eprintln!("[LFC] Initializing system tray...");

    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Show Status"))
        .add_item(CustomMenuItem::new("dashboard", "Open Dashboard"))
        .add_item(CustomMenuItem::new("sync", "Sync Now"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "Quit"));

    // Render "LFC" as a bold 36x22 template icon (black on transparent, 2px stroke)
    let (w, h) = (36u32, 22u32);
    let mut rgba = vec![0u8; (w * h * 4) as usize];
    // Bold letter bitmaps (7 wide x 11 tall) with 2px strokes
    let letters: [([u16; 11], u32); 3] = [
        // L
        ([
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1111111,
            0b1111111,
        ], 3),
        // F
        ([
            0b1111111,
            0b1111111,
            0b1100000,
            0b1100000,
            0b1111110,
            0b1111110,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
        ], 13),
        // C
        ([
            0b0111111,
            0b1111111,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1100000,
            0b1111111,
            0b0111111,
        ], 23),
    ];
    for (rows, x_off) in &letters {
        for (row_idx, row) in rows.iter().enumerate() {
            for bit in 0..7u32 {
                if row & (1 << (6 - bit)) != 0 {
                    let x = x_off + bit;
                    let y = 6 + row_idx as u32;
                    if x < w && y < h {
                        let idx = ((y * w + x) * 4) as usize;
                        rgba[idx] = 0;
                        rgba[idx + 1] = 0;
                        rgba[idx + 2] = 0;
                        rgba[idx + 3] = 255;
                    }
                }
            }
        }
    }
    let system_tray = SystemTray::new()
        .with_icon(tauri::Icon::Rgba { rgba, width: w, height: h })
        .with_icon_as_template(true)
        .with_menu(tray_menu);

    let app_state = AppState::new();

    let mut app = tauri::Builder::default()
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
                "dashboard" => {
                    let url = if cfg!(debug_assertions) {
                        "http://localhost:5173"
                    } else {
                        "https://app.lfc.dev"
                    };
                    let _ = open::that(url);
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
            eprintln!("[LFC] App setup running, system tray should be active");

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
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| {
        // Keep running when all windows are closed (tray-only app)
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            api.prevent_exit();
        }
    });
}
