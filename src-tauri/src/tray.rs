use crate::coordinator::AppCoordinator;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Show RESONA", true, None::<&str>)?;
    let fullscreen_item =
        MenuItem::with_id(app, "fullscreen", "Launch Fullscreen", true, None::<&str>)?;
    let toggle_pause_item =
        MenuItem::with_id(app, "toggle_pause", "Toggle Auto-Idle", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&show_item, &fullscreen_item, &toggle_pause_item, &quit_item],
    )?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "fullscreen" => {
                let coordinator = app.state::<AppCoordinator>();
                coordinator.on_manual_start();
            }
            "toggle_pause" => {
                let coordinator = app.state::<AppCoordinator>();
                let current = coordinator.get_state().policy.paused;
                coordinator.set_paused(!current);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
