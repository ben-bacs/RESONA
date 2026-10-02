use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SceneId {
    PulseRing,
    SilkWave,
    StarDrift,
    NeonHighway,
    Aurora,
    Ripple,
    Prism,
    Shockwave,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AudioActivityState {
    Active,
    Silent,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisFrame {
    pub schema_version: u32,
    pub session_id: String,
    pub sequence: u64,
    pub captured_at_us: u64,
    pub sample_rate_hz: u32,
    pub bands: Vec<f32>,
    pub rms: f32,
    pub peak: f32,
    pub bass: f32,
    pub mid: f32,
    pub treble: f32,
    pub transient_counter: u64,
    pub transient_strength: f32,
    pub activity: AudioActivityState,
    pub discontinuity: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceParameters {
    pub brightness: f32,
    pub sensitivity: f32,
    pub motion_speed: f32,
    pub color_palette: String,
    pub bloom_intensity: f32,
}

impl Default for AppearanceParameters {
    fn default() -> Self {
        Self {
            brightness: 0.85,
            sensitivity: 1.0,
            motion_speed: 1.0,
            color_palette: "neon_violet".to_string(),
            bloom_intensity: 0.6,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioEndpoint {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DisplayMode {
    Dormant,
    Preview,
    OpeningManual,
    OpeningAuto,
    ManualFullscreen,
    AutoFullscreen,
    Suspended,
    RendererFailed,
    Exiting,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CaptureMode {
    Off,
    Starting,
    Running,
    Recovering,
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerState {
    pub awake: bool,
    pub unlocked: bool,
    pub display_on: bool,
    pub on_battery: bool,
}

impl Default for PowerState {
    fn default() -> Self {
        Self {
            awake: true,
            unlocked: true,
            display_on: true,
            on_battery: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiState {
    pub main_visible: bool,
    pub preview_requested: bool,
    pub preview_paused: bool,
    pub fullscreen_visible: bool,
}

impl Default for UiState {
    fn default() -> Self {
        Self {
            main_visible: true,
            preview_requested: false,
            preview_paused: false,
            fullscreen_visible: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicyState {
    pub auto_enabled: bool,
    pub paused: bool,
    pub idle_delay_sec: u32,
    pub audio_gate_enabled: bool,
    pub renderer_blocked: bool,
}

impl Default for PolicyState {
    fn default() -> Self {
        Self {
            auto_enabled: true,
            paused: false,
            idle_delay_sec: 60,
            audio_gate_enabled: true,
            renderer_blocked: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservationState {
    pub os_idle_sec: f32,
    pub app_idle_sec: f32,
    pub foreground_suppressed: bool,
    pub audio_active: bool,
    pub monitor_available: bool,
}

impl Default for ObservationState {
    fn default() -> Self {
        Self {
            os_idle_sec: 0.0,
            app_idle_sec: 0.0,
            foreground_suppressed: false,
            audio_active: false,
            monitor_available: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeState {
    pub display: DisplayMode,
    pub capture: CaptureMode,
    pub power: PowerState,
    pub ui: UiState,
    pub policy: PolicyState,
    pub observation: ObservationState,
    pub selected_preset: SceneId,
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            display: DisplayMode::Dormant,
            capture: CaptureMode::Off,
            power: PowerState::default(),
            ui: UiState::default(),
            policy: PolicyState::default(),
            observation: ObservationState::default(),
            selected_preset: SceneId::PulseRing,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferences {
    pub auto_enabled: bool,
    pub idle_delay_sec: u32,
    pub audio_gate_enabled: bool,
    pub selected_preset: SceneId,
    pub target_monitor_id: Option<String>,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            auto_enabled: true,
            idle_delay_sec: 60,
            audio_gate_enabled: true,
            selected_preset: SceneId::PulseRing,
            target_monitor_id: None,
        }
    }
}
