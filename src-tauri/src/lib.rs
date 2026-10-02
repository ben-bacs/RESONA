pub mod audio;
pub mod coordinator;
pub mod dsp;
pub mod ipc;
pub mod persistence;
pub mod types;

use coordinator::AppCoordinator;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppCoordinator::new())
        .invoke_handler(tauri::generate_handler![
            ipc::get_runtime_state,
            ipc::set_display_mode,
            ipc::set_selected_preset,
            ipc::set_paused,
            ipc::list_audio_endpoints
        ])
        .run(tauri::generate_context!())
        .expect("error while running RESONA native application");
}
