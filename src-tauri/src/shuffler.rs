use crate::types::{LookRef, SettingsSnapshot, ShuffleSource};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShufflerAction {
    None,
    EffectiveOff,
    Stay(LookRef),
    TransitionTo(LookRef),
}

pub struct SceneShuffler {
    current_look: Option<LookRef>,
    elapsed_seconds: f32,
    prng_state: u64,
}

impl Default for SceneShuffler {
    fn default() -> Self {
        Self {
            current_look: None,
            elapsed_seconds: 0.0,
            prng_state: 88172645463325252,
        }
    }
}

impl SceneShuffler {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_seed(seed: u64) -> Self {
        Self {
            current_look: None,
            elapsed_seconds: 0.0,
            prng_state: seed.max(1),
        }
    }

    fn next_random(&mut self) -> u64 {
        // Simple Xorshift64
        self.prng_state ^= self.prng_state << 13;
        self.prng_state ^= self.prng_state >> 7;
        self.prng_state ^= self.prng_state << 17;
        self.prng_state
    }

    pub fn current_look(&self) -> Option<&LookRef> {
        self.current_look.as_ref()
    }

    pub fn reset_timer(&mut self) {
        self.elapsed_seconds = 0.0;
    }

    pub fn set_current_look(&mut self, look: LookRef) {
        self.current_look = Some(look);
        self.elapsed_seconds = 0.0;
    }

    pub fn get_eligible_looks(&self, snapshot: &SettingsSnapshot) -> Vec<LookRef> {
        let raw_refs = match snapshot.shuffle.source {
            ShuffleSource::Favorites => &snapshot.favorites,
            ShuffleSource::Selected => &snapshot.shuffle.selected,
        };

        // Filter: ensure each lookRef points to an existing variation or built-in scene
        raw_refs
            .iter()
            .filter(|r| match r {
                LookRef::Builtin { .. } => true,
                LookRef::Variation { id } => snapshot.variations.iter().any(|v| &v.id == id),
            })
            .cloned()
            .collect()
    }

    pub fn step(
        &mut self,
        dt_seconds: f32,
        is_fullscreen_visible: bool,
        snapshot: &SettingsSnapshot,
    ) -> ShufflerAction {
        if !snapshot.shuffle.enabled {
            return ShufflerAction::None;
        }

        // Timer runs only in visible fullscreen per SDD Section 12
        if !is_fullscreen_visible {
            return ShufflerAction::None;
        }

        let eligible = self.get_eligible_looks(snapshot);
        if eligible.is_empty() {
            return ShufflerAction::EffectiveOff;
        }

        if eligible.len() == 1 {
            let only_ref = eligible[0].clone();
            if self.current_look.as_ref() != Some(&only_ref) {
                self.current_look = Some(only_ref.clone());
                return ShufflerAction::TransitionTo(only_ref);
            }
            return ShufflerAction::Stay(only_ref);
        }

        // Multiple eligible looks: advance timer
        self.elapsed_seconds += dt_seconds;
        let interval_seconds = (snapshot.shuffle.interval_minutes.clamp(1, 30) as f32) * 60.0;

        // If no current look set yet, pick one immediately
        if self.current_look.is_none() {
            let idx = (self.next_random() as usize) % eligible.len();
            let chosen = eligible[idx].clone();
            self.current_look = Some(chosen.clone());
            self.elapsed_seconds = 0.0;
            return ShufflerAction::TransitionTo(chosen);
        }

        if self.elapsed_seconds >= interval_seconds {
            self.elapsed_seconds = 0.0;

            // Pick uniformly from eligible looks OTHER than current look (no immediate repetition)
            let candidates: Vec<&LookRef> = eligible
                .iter()
                .filter(|r| Some(*r) != self.current_look.as_ref())
                .collect();

            if candidates.is_empty() {
                return ShufflerAction::Stay(self.current_look.clone().unwrap());
            }

            let idx = (self.next_random() as usize) % candidates.len();
            let next_look = candidates[idx].clone();
            self.current_look = Some(next_look.clone());

            return ShufflerAction::TransitionTo(next_look);
        }

        ShufflerAction::None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CommittedLook, PresetVariation, SceneId, ShuffleConfig};

    fn make_test_snapshot(
        favorites: Vec<LookRef>,
        variations: Vec<PresetVariation>,
        shuffle_enabled: bool,
    ) -> SettingsSnapshot {
        SettingsSnapshot {
            schema_version: 1,
            revision: 1,
            preferences: Default::default(),
            committed_look: CommittedLook::default(),
            variations,
            favorites,
            shuffle: ShuffleConfig {
                enabled: shuffle_enabled,
                source: ShuffleSource::Favorites,
                selected: Vec::new(),
                interval_minutes: 1, // 60 seconds
            },
            onboarding_completed: true,
            close_to_tray_explained: true,
        }
    }

    #[test]
    fn test_zero_eligible_is_effective_off() {
        let mut shuffler = SceneShuffler::with_seed(42);
        let snap = make_test_snapshot(vec![], vec![], true);

        let action = shuffler.step(10.0, true, &snap);
        assert_eq!(action, ShufflerAction::EffectiveOff);
    }

    #[test]
    fn test_single_eligible_stays_without_reload() {
        let mut shuffler = SceneShuffler::with_seed(42);
        let look = LookRef::Builtin {
            scene_id: SceneId::SilkWave,
        };
        let snap = make_test_snapshot(vec![look.clone()], vec![], true);

        // First tick transitions into the single look
        let action1 = shuffler.step(1.0, true, &snap);
        assert_eq!(action1, ShufflerAction::TransitionTo(look.clone()));

        // Subsequent ticks stay without reload
        let action2 = shuffler.step(100.0, true, &snap);
        assert_eq!(action2, ShufflerAction::Stay(look));
    }

    #[test]
    fn test_multiple_eligible_no_immediate_repeat() {
        let mut shuffler = SceneShuffler::with_seed(12345);
        let look1 = LookRef::Builtin {
            scene_id: SceneId::PulseRing,
        };
        let look2 = LookRef::Builtin {
            scene_id: SceneId::Aurora,
        };
        let snap = make_test_snapshot(vec![look1.clone(), look2.clone()], vec![], true);

        // Initial pick
        let a1 = shuffler.step(1.0, true, &snap);
        let first_chosen = match a1 {
            ShufflerAction::TransitionTo(l) => l,
            _ => panic!("Expected initial transition"),
        };

        // Advance 60 seconds to trigger interval shuffle
        let a2 = shuffler.step(61.0, true, &snap);
        match a2 {
            ShufflerAction::TransitionTo(l) => {
                assert_ne!(l, first_chosen, "Must not immediately repeat current look");
            }
            _ => panic!("Expected interval transition"),
        }
    }

    #[test]
    fn test_paused_when_not_in_fullscreen() {
        let mut shuffler = SceneShuffler::with_seed(42);
        let look1 = LookRef::Builtin {
            scene_id: SceneId::PulseRing,
        };
        let look2 = LookRef::Builtin {
            scene_id: SceneId::Aurora,
        };
        let snap = make_test_snapshot(vec![look1, look2], vec![], true);

        // Not in fullscreen -> no action
        let action = shuffler.step(1000.0, false, &snap);
        assert_eq!(action, ShufflerAction::None);
    }
}
