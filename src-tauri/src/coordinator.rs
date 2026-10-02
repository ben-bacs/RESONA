use crate::types::{CaptureMode, DisplayMode, RuntimeState, SceneId};
use std::sync::{Arc, Mutex};

pub struct AppCoordinator {
    state: Arc<Mutex<RuntimeState>>,
}

impl AppCoordinator {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(RuntimeState::default())),
        }
    }

    pub fn get_state(&self) -> RuntimeState {
        self.state.lock().unwrap().clone()
    }

    /// Evaluates auto-idle eligibility predicate per RESONA_08_SDD.md Section 4:
    /// autoEligible = enabled && !paused && awake && unlocked && displayOn && !mainVisible
    /// && !manualActive && idleSatisfied && !suppressed && audioSatisfied && monitorUsable
    /// && !rendererBlocked
    pub fn is_auto_eligible(state: &RuntimeState) -> bool {
        let policy = &state.policy;
        let power = &state.power;
        let ui = &state.ui;
        let obs = &state.observation;

        let enabled_and_unpaused = policy.auto_enabled && !policy.paused;
        let session_ready = power.awake && power.unlocked && power.display_on;
        let window_not_blocking = !ui.main_visible && !ui.fullscreen_visible;
        let idle_satisfied = (obs.os_idle_sec >= policy.idle_delay_sec as f32)
            && (obs.app_idle_sec >= policy.idle_delay_sec as f32);
        let audio_satisfied = !policy.audio_gate_enabled || obs.audio_active;
        let environment_ok = !obs.foreground_suppressed && obs.monitor_available && !policy.renderer_blocked;

        enabled_and_unpaused
            && session_ready
            && window_not_blocking
            && idle_satisfied
            && audio_satisfied
            && environment_ok
    }

    pub fn on_tick(&self, delta_sec: f32, os_idle_sec: f32, audio_active: bool) {
        let mut state = self.state.lock().unwrap();

        state.observation.os_idle_sec = os_idle_sec;
        state.observation.audio_active = audio_active;
        state.observation.app_idle_sec += delta_sec;

        // User activity detection during auto mode: if OS idle < 0.5s, dismiss auto fullscreen
        if os_idle_sec < 0.5 {
            if state.display == DisplayMode::AutoFullscreen || state.display == DisplayMode::OpeningAuto {
                state.display = DisplayMode::Dormant;
                state.ui.fullscreen_visible = false;
                state.observation.app_idle_sec = 0.0;
                return;
            }
        }

        // Check for automatic activation
        if state.display == DisplayMode::Dormant && Self::is_auto_eligible(&state) {
            state.display = DisplayMode::OpeningAuto;
            state.ui.fullscreen_visible = true;
        }
    }

    pub fn on_renderer_ready(&self) {
        let mut state = self.state.lock().unwrap();
        match state.display {
            DisplayMode::OpeningAuto => {
                state.display = DisplayMode::AutoFullscreen;
            }
            DisplayMode::OpeningManual => {
                state.display = DisplayMode::ManualFullscreen;
            }
            _ => {}
        }
    }

    pub fn on_manual_start(&self) {
        let mut state = self.state.lock().unwrap();
        state.display = DisplayMode::ManualFullscreen;
        state.ui.fullscreen_visible = true;
        state.observation.app_idle_sec = 0.0;
    }

    pub fn on_manual_exit(&self) {
        let mut state = self.state.lock().unwrap();
        if state.display == DisplayMode::ManualFullscreen || state.display == DisplayMode::OpeningManual {
            state.display = DisplayMode::Dormant;
            state.ui.fullscreen_visible = false;
            state.observation.app_idle_sec = 0.0;
        }
    }

    pub fn on_auto_dismiss(&self) {
        let mut state = self.state.lock().unwrap();
        if state.display == DisplayMode::AutoFullscreen || state.display == DisplayMode::OpeningAuto {
            state.display = DisplayMode::Dormant;
            state.ui.fullscreen_visible = false;
            state.observation.app_idle_sec = 0.0;
        }
    }

    pub fn on_main_window_visibility(&self, visible: bool) {
        let mut state = self.state.lock().unwrap();
        state.ui.main_visible = visible;
        if !visible {
            // SRS-D02: Main window hidden resets application auto idle baseline
            state.observation.app_idle_sec = 0.0;
        }
    }

    pub fn on_session_lock(&self) {
        let mut state = self.state.lock().unwrap();
        state.power.unlocked = false;
        state.display = DisplayMode::Suspended;
        state.ui.fullscreen_visible = false;
        state.capture = CaptureMode::Off;
        state.observation.app_idle_sec = 0.0;
    }

    pub fn on_session_unlock(&self) {
        let mut state = self.state.lock().unwrap();
        state.power.unlocked = true;
        if state.display == DisplayMode::Suspended {
            state.display = DisplayMode::Dormant;
        }
        // SDD: Fresh idle delay required after unlock
        state.observation.app_idle_sec = 0.0;
    }

    pub fn on_power_suspend(&self) {
        let mut state = self.state.lock().unwrap();
        state.power.awake = false;
        state.display = DisplayMode::Suspended;
        state.ui.fullscreen_visible = false;
        state.capture = CaptureMode::Off;
        state.observation.app_idle_sec = 0.0;
    }

    pub fn on_power_resume(&self) {
        let mut state = self.state.lock().unwrap();
        state.power.awake = true;
        if state.display == DisplayMode::Suspended {
            state.display = DisplayMode::Dormant;
        }
        // SDD: Fresh idle delay required after resume
        state.observation.app_idle_sec = 0.0;
    }

    pub fn on_display_off(&self) {
        let mut state = self.state.lock().unwrap();
        state.power.display_on = false;
        if state.display != DisplayMode::Exiting {
            state.display = DisplayMode::Suspended;
            state.ui.fullscreen_visible = false;
            state.capture = CaptureMode::Off;
            state.observation.app_idle_sec = 0.0;
        }
    }

    pub fn on_display_on(&self) {
        let mut state = self.state.lock().unwrap();
        state.power.display_on = true;
        if state.display == DisplayMode::Suspended {
            state.display = DisplayMode::Dormant;
        }
        state.observation.app_idle_sec = 0.0;
    }

    pub fn on_renderer_failed(&self, _error: String) {
        let mut state = self.state.lock().unwrap();
        state.display = DisplayMode::RendererFailed;
        state.policy.renderer_blocked = true;
        state.ui.fullscreen_visible = false;
    }

    pub fn on_renderer_recovered(&self) {
        let mut state = self.state.lock().unwrap();
        state.policy.renderer_blocked = false;
        state.display = DisplayMode::Dormant;
        state.observation.app_idle_sec = 0.0;
    }

    pub fn set_paused(&self, paused: bool) {
        let mut state = self.state.lock().unwrap();
        state.policy.paused = paused;
        if !paused {
            state.observation.app_idle_sec = 0.0;
        }
    }

    pub fn set_selected_preset(&self, preset: SceneId) {
        let mut state = self.state.lock().unwrap();
        state.selected_preset = preset;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auto_eligibility_predicates() {
        let mut state = RuntimeState::default();
        // Initially main_visible is true -> not eligible
        assert!(!AppCoordinator::is_auto_eligible(&state));

        // Hide main window
        state.ui.main_visible = false;
        // Idle not satisfied (default idle_sec is 0.0 vs 60s)
        assert!(!AppCoordinator::is_auto_eligible(&state));

        // Satisfy idle
        state.observation.os_idle_sec = 65.0;
        state.observation.app_idle_sec = 65.0;
        // Audio gate is enabled, audio_active is false -> not eligible
        assert!(!AppCoordinator::is_auto_eligible(&state));

        // Satisfy audio
        state.observation.audio_active = true;
        // Now all conditions met -> ELIGIBLE!
        assert!(AppCoordinator::is_auto_eligible(&state));

        // Paused should block eligibility
        state.policy.paused = true;
        assert!(!AppCoordinator::is_auto_eligible(&state));
        state.policy.paused = false;
        assert!(AppCoordinator::is_auto_eligible(&state));

        // Foreground suppression should block eligibility
        state.observation.foreground_suppressed = true;
        assert!(!AppCoordinator::is_auto_eligible(&state));
        state.observation.foreground_suppressed = false;
        assert!(AppCoordinator::is_auto_eligible(&state));

        // Locked session should block eligibility
        state.power.unlocked = false;
        assert!(!AppCoordinator::is_auto_eligible(&state));
    }

    #[test]
    fn test_lock_and_unlock_requires_fresh_idle_baseline() {
        let coordinator = AppCoordinator::new();
        coordinator.on_main_window_visibility(false);

        // Advance time to satisfy 60s idle
        coordinator.on_tick(65.0, 65.0, true);
        let s1 = coordinator.get_state();
        assert_eq!(s1.display, DisplayMode::OpeningAuto);

        // Lock session
        coordinator.on_session_lock();
        let s2 = coordinator.get_state();
        assert_eq!(s2.display, DisplayMode::Suspended);
        assert!(!s2.power.unlocked);
        assert_eq!(s2.observation.app_idle_sec, 0.0);

        // Unlock session
        coordinator.on_session_unlock();
        let s3 = coordinator.get_state();
        assert_eq!(s3.display, DisplayMode::Dormant);
        assert!(s3.power.unlocked);
        // Must require a fresh idle interval!
        assert_eq!(s3.observation.app_idle_sec, 0.0);
        assert!(!AppCoordinator::is_auto_eligible(&s3));
    }

    #[test]
    fn test_manual_start_and_exit_lifecycle() {
        let coordinator = AppCoordinator::new();
        assert_eq!(coordinator.get_state().display, DisplayMode::Dormant);

        coordinator.on_manual_start();
        assert_eq!(coordinator.get_state().display, DisplayMode::ManualFullscreen);
        assert!(coordinator.get_state().ui.fullscreen_visible);

        coordinator.on_manual_exit();
        assert_eq!(coordinator.get_state().display, DisplayMode::Dormant);
        assert!(!coordinator.get_state().ui.fullscreen_visible);
    }
}
