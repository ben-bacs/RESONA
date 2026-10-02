pub mod audio;
pub mod coordinator;
pub mod dsp;
pub mod ipc;
pub mod persistence;
pub mod types;

use audio::AudioSupervisor;
use coordinator::AppCoordinator;
use ipc::AudioState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppCoordinator::new())
        .manage(AudioState(Mutex::new(AudioSupervisor::new())))
        .invoke_handler(tauri::generate_handler![
            ipc::get_runtime_state,
            ipc::set_display_mode,
            ipc::set_selected_preset,
            ipc::set_paused,
            ipc::list_audio_endpoints,
            ipc::start_audio_capture,
            ipc::stop_audio_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running RESONA native application");
}
