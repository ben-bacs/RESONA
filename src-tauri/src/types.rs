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
    pub bands: Vec<f32>, // 64 logarithmic bands
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

impl Default for AnalysisFrame {
    fn default() -> Self {
        Self {
            schema_version: 1,
            session_id: "init".to_string(),
            sequence: 0,
            captured_at_us: 0,
            sample_rate_hz: 48000,
            bands: vec![0.0; 64],
            rms: 0.0,
            peak: 0.0,
            bass: 0.0,
            mid: 0.0,
            treble: 0.0,
            transient_counter: 0,
            transient_strength: 0.0,
            activity: AudioActivityState::Silent,
            discontinuity: false,
        }
    }
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeState {
    pub display: DisplayMode,
    pub capture: CaptureMode,
    pub is_paused: bool,
    pub selected_preset: SceneId,
}
