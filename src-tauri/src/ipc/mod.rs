use crate::coordinator::AppCoordinator;
use crate::types::{AudioEndpoint, DisplayMode, RuntimeState, SceneId};
use tauri::State;

#[tauri::command]
pub fn get_runtime_state(coordinator: State<AppCoordinator>) -> RuntimeState {
    coordinator.get_state()
}

#[tauri::command]
pub fn set_display_mode(coordinator: State<AppCoordinator>, mode: DisplayMode) {
    coordinator.set_display_mode(mode);
}

#[tauri::command]
pub fn set_selected_preset(coordinator: State<AppCoordinator>, preset: SceneId) {
    coordinator.set_selected_preset(preset);
}

#[tauri::command]
pub fn set_paused(coordinator: State<AppCoordinator>, paused: bool) {
    coordinator.set_paused(paused);
}

#[tauri::command]
pub fn list_audio_endpoints() -> Vec<AudioEndpoint> {
    vec![AudioEndpoint {
        id: "default_render".to_string(),
        name: "Default Playback Device (WASAPI Loopback)".to_string(),
        is_default: true,
    }]
}
