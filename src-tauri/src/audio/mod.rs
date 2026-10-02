use crate::types::{AudioEndpoint, CaptureMode};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

pub struct WasapiCapture {
    _endpoint_id: String,
    is_running: Arc<AtomicBool>,
    sample_rate: u32,
    channels: u16,
}

impl WasapiCapture {
    pub fn new(endpoint_id: String) -> Self {
        Self {
            _endpoint_id: endpoint_id,
            is_running: Arc::new(AtomicBool::new(false)),
            sample_rate: 48000,
            channels: 2,
        }
    }

    pub fn start(&mut self) -> Result<(), String> {
        self.is_running.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub fn stop(&mut self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    pub fn is_active(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    pub fn channels(&self) -> u16 {
        self.channels
    }
}

pub struct AudioSupervisor {
    current_capture: Option<WasapiCapture>,
    retry_count: u32,
    _last_event_time: Option<Instant>,
    capture_mode: CaptureMode,
}

impl AudioSupervisor {
    pub fn new() -> Self {
        Self {
            current_capture: None,
            retry_count: 0,
            _last_event_time: None,
            capture_mode: CaptureMode::Off,
        }
    }

    pub fn enumerate_endpoints(&self) -> Vec<AudioEndpoint> {
        vec![
            AudioEndpoint {
                id: "default_render".to_string(),
                name: "Default Windows Playback (WASAPI Loopback)".to_string(),
                is_default: true,
            },
            AudioEndpoint {
                id: "speakers_01".to_string(),
                name: "Speakers / Headphones".to_string(),
                is_default: false,
            },
        ]
    }

    pub fn start_capture(&mut self, endpoint_id: Option<String>) -> Result<(), String> {
        let ep = endpoint_id.unwrap_or_else(|| "default_render".to_string());
        let mut capture = WasapiCapture::new(ep);
        capture.start()?;
        self.current_capture = Some(capture);
        self.capture_mode = CaptureMode::Running;
        self.retry_count = 0;
        Ok(())
    }

    pub fn stop_capture(&mut self) {
        if let Some(mut capture) = self.current_capture.take() {
            capture.stop();
        }
        self.capture_mode = CaptureMode::Off;
    }

    pub fn capture_mode(&self) -> CaptureMode {
        self.capture_mode
    }

    /// Handles device change or stream error with SDD-specified retry schedule (0.5s, 1s, 2s)
    pub fn handle_stream_error(&mut self) -> Option<Duration> {
        if self.retry_count < 3 {
            self.retry_count += 1;
            let delay = match self.retry_count {
                1 => Duration::from_millis(500),
                2 => Duration::from_millis(1000),
                _ => Duration::from_millis(2000),
            };
            self.capture_mode = CaptureMode::Recovering;
            Some(delay)
        } else {
            self.capture_mode = CaptureMode::Unavailable;
            None
        }
    }
}
