use crate::audio::AudioSupervisor;
use crate::coordinator::AppCoordinator;
use crate::persistence::PersistenceService;
use crate::shuffler::{SceneShuffler, ShufflerAction};
use crate::types::{
    AnalysisFrame, AppearanceParameters, AudioEndpoint, DisplayMode, ImportReviewResponse,
    LookRef, RuntimeState, SceneId, SettingsSnapshot, ShuffleConfig, UserPreferences,
};
use std::sync::Mutex;
use tauri::State;

pub struct AudioState(pub Mutex<AudioSupervisor>);
pub struct PersistenceState(pub Mutex<PersistenceService>);
pub struct ShufflerState(pub Mutex<SceneShuffler>);

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
pub fn get_latest_analysis_frame(audio_state: State<AudioState>) -> Option<AnalysisFrame> {
    audio_state.0.lock().unwrap().get_latest_frame()
}

#[tauri::command]
pub fn get_settings_snapshot(persistence: State<PersistenceState>) -> SettingsSnapshot {
    persistence.0.lock().unwrap().load_snapshot()
}

#[tauri::command]
pub fn save_settings_snapshot(
    persistence: State<PersistenceState>,
    snapshot: SettingsSnapshot,
    expected_revision: Option<u64>,
) -> Result<SettingsSnapshot, String> {
    persistence
        .0
        .lock()
        .unwrap()
        .save_snapshot(&snapshot, expected_revision)
}

#[tauri::command]
pub fn toggle_favorite(
    persistence: State<PersistenceState>,
    look_ref: LookRef,
) -> Result<Vec<LookRef>, String> {
    persistence.0.lock().unwrap().toggle_favorite(look_ref)
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

// --- Variations CRUD IPC Commands ---

#[tauri::command]
pub fn create_variation(
    persistence: State<PersistenceState>,
    name: String,
    scene_id: SceneId,
    appearance: AppearanceParameters,
    expected_revision: Option<u64>,
) -> Result<SettingsSnapshot, String> {
    persistence
        .0
        .lock()
        .unwrap()
        .create_variation(name, scene_id, appearance, expected_revision)
}

#[tauri::command]
pub fn update_variation(
    persistence: State<PersistenceState>,
    id: String,
    appearance: AppearanceParameters,
    expected_revision: Option<u64>,
) -> Result<SettingsSnapshot, String> {
    persistence
        .0
        .lock()
        .unwrap()
        .update_variation(&id, appearance, expected_revision)
}

#[tauri::command]
pub fn rename_variation(
    persistence: State<PersistenceState>,
    id: String,
    new_name: String,
    expected_revision: Option<u64>,
) -> Result<SettingsSnapshot, String> {
    persistence
        .0
        .lock()
        .unwrap()
        .rename_variation(&id, &new_name, expected_revision)
}

#[tauri::command]
pub fn delete_variation(
    persistence: State<PersistenceState>,
    id: String,
    expected_revision: Option<u64>,
) -> Result<SettingsSnapshot, String> {
    persistence
        .0
        .lock()
        .unwrap()
        .delete_variation(&id, expected_revision)
}

// --- Import / Export IPC Commands ---

#[tauri::command]
pub fn begin_import(
    persistence: State<PersistenceState>,
    json_string: String,
) -> Result<ImportReviewResponse, String> {
    persistence
        .0
        .lock()
        .unwrap()
        .begin_import(json_string.as_bytes())
}

#[tauri::command]
pub fn commit_import(
    persistence: State<PersistenceState>,
    token: String,
    expected_revision: Option<u64>,
) -> Result<SettingsSnapshot, String> {
    persistence
        .0
        .lock()
        .unwrap()
        .commit_import(&token, expected_revision)
}

#[tauri::command]
pub fn cancel_import(persistence: State<PersistenceState>, token: String) {
    persistence.0.lock().unwrap().cancel_import(&token);
}

#[tauri::command]
pub fn export_variation(
    persistence: State<PersistenceState>,
    id: String,
) -> Result<String, String> {
    persistence.0.lock().unwrap().export_variation(&id)
}

// --- Shuffle IPC Commands ---

#[tauri::command]
pub fn save_shuffle_config(
    persistence: State<PersistenceState>,
    config: ShuffleConfig,
    expected_revision: Option<u64>,
) -> Result<SettingsSnapshot, String> {
    let mut snap = persistence.0.lock().unwrap().load_snapshot();
    snap.shuffle = config;
    persistence
        .0
        .lock()
        .unwrap()
        .save_snapshot(&snap, expected_revision)
}

#[tauri::command]
pub fn step_shuffler(
    persistence: State<PersistenceState>,
    shuffler: State<ShufflerState>,
    delta_sec: f32,
    is_fullscreen_visible: bool,
) -> Option<LookRef> {
    let snap = persistence.0.lock().unwrap().load_snapshot();
    let action = shuffler
        .0
        .lock()
        .unwrap()
        .step(delta_sec, is_fullscreen_visible, &snap);

    match action {
        ShufflerAction::TransitionTo(look_ref) => Some(look_ref),
        _ => None,
    }
}

