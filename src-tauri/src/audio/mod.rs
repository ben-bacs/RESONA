use crate::types::AudioEndpoint;

pub struct AudioSupervisor;

impl AudioSupervisor {
    pub fn new() -> Self {
        Self
    }

    pub fn enumerate_endpoints(&self) -> Vec<AudioEndpoint> {
        // Enumerate Windows multimedia rendering endpoints
        vec![AudioEndpoint {
            id: "default_render".to_string(),
            name: "Default Playback Device (WASAPI Loopback)".to_string(),
            is_default: true,
        }]
    }
}
