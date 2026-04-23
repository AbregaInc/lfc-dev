#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod artifact_sync;
mod state;
mod sync;

use state::AppState;
use tauri::{
    image::Image,
    menu::MenuBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
#[cfg(not(debug_assertions))]
use tauri_plugin_updater::UpdaterExt;

fn show_main_window<R: tauri::Runtime, M: Manager<R>>(manager: &M) {
    if let Some(window) = manager.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn spawn_sync<R: tauri::Runtime>(app_handle: tauri::AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        let state = app_handle.state::<AppState>();
        match commands::sync_now(state).await {
            Ok(()) => println!("[LFC] Tray sync complete"),
            Err(e) => println!("[LFC] Tray sync error: {}", e),
        }
    });
}

fn spawn_background_sync_loop<R: tauri::Runtime>(app_handle: tauri::AppHandle<R>) {
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
                if let Err(e) = commands::sync_now(state).await {
                    println!("[LFC] Background sync error: {}", e);
                }
            }
        }
    });
}

fn spawn_update_check<R: tauri::Runtime>(app_handle: tauri::AppHandle<R>) {
    #[cfg(debug_assertions)]
    {
        let _ = app_handle;
        return;
    }

    #[cfg(not(debug_assertions))]
    tauri::async_runtime::spawn(async move {
        let updater = match app_handle.updater() {
            Ok(updater) => updater,
            Err(err) => {
                eprintln!("[LFC] Updater unavailable: {}", err);
                return;
            }
        };

        let update = match updater.check().await {
            Ok(update) => update,
            Err(err) => {
                eprintln!("[LFC] Update check failed: {}", err);
                return;
            }
        };

        let Some(update) = update else {
            return;
        };

        eprintln!("[LFC] Installing update {}", update.version);

        if let Err(err) = update.download_and_install(|_, _| {}, || {}).await {
            eprintln!("[LFC] Update install failed: {}", err);
            return;
        }

        app_handle.restart();
    });
}

fn main() {
    eprintln!("[LFC] Initializing system tray...");

    // Render "LFC" as a bold 36x22 template icon (black on transparent, 2px stroke)
    let (w, h) = (36u32, 22u32);
    let mut rgba = vec![0u8; (w * h * 4) as usize];
    // Bold letter bitmaps (7 wide x 11 tall) with 2px strokes
    let letters: [([u16; 11], u32); 3] = [
        // L
        (
            [
                0b1100000, 0b1100000, 0b1100000, 0b1100000, 0b1100000, 0b1100000, 0b1100000,
                0b1100000, 0b1100000, 0b1111111, 0b1111111,
            ],
            3,
        ),
        // F
        (
            [
                0b1111111, 0b1111111, 0b1100000, 0b1100000, 0b1111110, 0b1111110, 0b1100000,
                0b1100000, 0b1100000, 0b1100000, 0b1100000,
            ],
            13,
        ),
        // C
        (
            [
                0b0111111, 0b1111111, 0b1100000, 0b1100000, 0b1100000, 0b1100000, 0b1100000,
                0b1100000, 0b1100000, 0b1111111, 0b0111111,
            ],
            23,
        ),
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
    let tray_icon = Image::new_owned(rgba, w, h);

    let app_state = AppState::new();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_window_event(|window, event| {
            // Hide instead of close when the user clicks the X button
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
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

            let tray_menu = MenuBuilder::new(app)
                .text("show", "Show Status")
                .text("dashboard", "Open Dashboard")
                .text("sync", "Sync Now")
                .separator()
                .text("quit", "Quit")
                .build()?;

            let mut tray_builder = TrayIconBuilder::with_id("main")
                .icon(tray_icon)
                .menu(&tray_menu)
                .title("LFC")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_main_window(app),
                    "dashboard" => {
                        let url = if cfg!(debug_assertions) {
                            "http://localhost:5173"
                        } else {
                            "https://app.lfc.dev"
                        };
                        let _ = open::that(url);
                    }
                    "sync" => {
                        spawn_sync(app.clone());
                    }
                    "quit" => std::process::exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) {
                        show_main_window(tray.app_handle());
                    }
                });

            #[cfg(target_os = "macos")]
            {
                tray_builder = tray_builder.icon_as_template(true);
            }

            let _ = tray_builder.build(app)?;

            // Show the window on launch so the user knows the app started
            show_main_window(app);

            let app_handle = app.handle().clone();
            spawn_update_check(app_handle.clone());
            spawn_background_sync_loop(app_handle);

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
