pub mod audio;
pub mod coordinator;
pub mod dsp;
pub mod ipc;
pub mod persistence;
pub mod session;
pub mod tray;
pub mod types;

use audio::AudioSupervisor;
use coordinator::AppCoordinator;
use ipc::{AudioState, PersistenceState};
use persistence::PersistenceService;
use std::path::PathBuf;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_dir = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("RESONA");

    tauri::Builder::default()
        .setup(|app| {
            let _ = tray::create_tray(app.handle());
            Ok(())
        })
        .manage(AppCoordinator::new())
        .manage(AudioState(Mutex::new(AudioSupervisor::new())))
        .manage(PersistenceState(Mutex::new(PersistenceService::new(
            config_dir,
        ))))
        .invoke_handler(tauri::generate_handler![
            ipc::get_runtime_state,
            ipc::set_display_mode,
            ipc::on_tick_update,
            ipc::on_manual_start,
            ipc::on_manual_exit,
            ipc::on_auto_dismiss,
            ipc::on_renderer_ready,
            ipc::set_selected_preset,
            ipc::set_paused,
            ipc::list_audio_endpoints,
            ipc::start_audio_capture,
            ipc::stop_audio_capture,
            ipc::get_user_preferences,
            ipc::save_user_preferences,
            ipc::get_appearance_parameters,
            ipc::save_appearance_parameters
        ])
        .run(tauri::generate_context!())
        .expect("error while running RESONA native application");
}
