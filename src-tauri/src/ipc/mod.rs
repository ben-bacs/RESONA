use crate::audio::AudioSupervisor;
use crate::coordinator::AppCoordinator;
use crate::persistence::PersistenceService;
use crate::types::{
    AppearanceParameters, AudioEndpoint, DisplayMode, RuntimeState, SceneId, UserPreferences,
};
use std::sync::Mutex;
use tauri::State;

pub struct AudioState(pub Mutex<AudioSupervisor>);
pub struct PersistenceState(pub Mutex<PersistenceService>);

#[tauri::command]
pub fn get_runtime_state(coordinator: State<AppCoordinator>) -> RuntimeState {
    coordinator.get_state()
}

#[tauri::command]
pub fn set_display_mode(coordinator: State<AppCoordinator>, mode: DisplayMode) {
    match mode {
        DisplayMode::ManualFullscreen => coordinator.on_manual_start(),
        DisplayMode::Dormant => coordinator.on_manual_exit(),
        _ => {}
    }
}

#[tauri::command]
pub fn on_tick_update(
    coordinator: State<AppCoordinator>,
    delta_sec: f32,
    audio_active: bool,
) -> RuntimeState {
    let os_idle = crate::session::get_os_idle_seconds();
    coordinator.on_tick(delta_sec, os_idle, audio_active);
    coordinator.get_state()
}

#[tauri::command]
pub fn on_manual_start(coordinator: State<AppCoordinator>) {
    coordinator.on_manual_start();
}

#[tauri::command]
pub fn on_manual_exit(coordinator: State<AppCoordinator>) {
    coordinator.on_manual_exit();
}

#[tauri::command]
pub fn on_auto_dismiss(coordinator: State<AppCoordinator>) {
    coordinator.on_auto_dismiss();
}

#[tauri::command]
pub fn on_renderer_ready(coordinator: State<AppCoordinator>) {
    coordinator.on_renderer_ready();
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

#[tauri::command]
pub fn get_user_preferences(persistence: State<PersistenceState>) -> UserPreferences {
    persistence.0.lock().unwrap().load_preferences()
}

#[tauri::command]
pub fn save_user_preferences(
    persistence: State<PersistenceState>,
    prefs: UserPreferences,
) -> Result<(), String> {
    persistence.0.lock().unwrap().save_preferences(&prefs)
}

#[tauri::command]
pub fn get_appearance_parameters(persistence: State<PersistenceState>) -> AppearanceParameters {
    persistence.0.lock().unwrap().load_parameters()
}

#[tauri::command]
pub fn save_appearance_parameters(
    persistence: State<PersistenceState>,
    params: AppearanceParameters,
) -> Result<(), String> {
    persistence.0.lock().unwrap().save_parameters(&params)
}
