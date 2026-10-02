use crate::audio::AudioSupervisor;
use crate::coordinator::AppCoordinator;
use crate::types::{AudioEndpoint, DisplayMode, RuntimeState, SceneId};
use std::sync::Mutex;
use tauri::State;

pub struct AudioState(pub Mutex<AudioSupervisor>);

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
pub fn list_audio_endpoints(audio_state: State<AudioState>) -> Vec<AudioEndpoint> {
    audio_state.0.lock().unwrap().enumerate_endpoints()
}

#[tauri::command]
pub fn start_audio_capture(
    audio_state: State<AudioState>,
    endpoint_id: Option<String>,
) -> Result<(), String> {
    audio_state.0.lock().unwrap().start_capture(endpoint_id)
}

#[tauri::command]
pub fn stop_audio_capture(audio_state: State<AudioState>) {
    audio_state.0.lock().unwrap().stop_capture();
}
