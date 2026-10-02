use crate::types::{CaptureMode, DisplayMode, RuntimeState, SceneId};
use std::sync::{Arc, Mutex};

pub struct AppCoordinator {
    state: Arc<Mutex<RuntimeState>>,
}

impl AppCoordinator {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(RuntimeState {
                display: DisplayMode::Dormant,
                capture: CaptureMode::Off,
                is_paused: false,
                selected_preset: SceneId::PulseRing,
            })),
        }
    }

    pub fn get_state(&self) -> RuntimeState {
        self.state.lock().unwrap().clone()
    }

    pub fn set_display_mode(&self, mode: DisplayMode) {
        let mut state = self.state.lock().unwrap();
        state.display = mode;
    }

    pub fn set_selected_preset(&self, preset: SceneId) {
        let mut state = self.state.lock().unwrap();
        state.selected_preset = preset;
    }

    pub fn set_paused(&self, paused: bool) {
        let mut state = self.state.lock().unwrap();
        state.is_paused = paused;
    }
}
