use crate::types::{AnalysisFrame, AudioActivityState};

pub struct DspEngine {
    sample_rate: u32,
}

impl DspEngine {
    pub fn new(sample_rate: u32) -> Self {
        Self { sample_rate }
    }

    pub fn compute_frame(&self, sequence: u64, session_id: &str) -> AnalysisFrame {
        AnalysisFrame {
            schema_version: 1,
            session_id: session_id.to_string(),
            sequence,
            captured_at_us: 0,
            sample_rate_hz: self.sample_rate,
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
