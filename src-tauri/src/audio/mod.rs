use crate::dsp::DspEngine;
use crate::types::{AnalysisFrame, AudioEndpoint, CaptureMode};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(windows)]
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDevice, IMMDeviceEnumerator,
    MMDeviceEnumerator, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
    WAVEFORMATEX,
};
#[cfg(windows)]
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
    COINIT_MULTITHREADED,
};

pub struct WasapiCapture {
    _endpoint_id: String,
    is_running: Arc<AtomicBool>,
    latest_frame: Arc<Mutex<Option<AnalysisFrame>>>,
    thread_handle: Option<thread::JoinHandle<()>>,
    sample_rate: u32,
    channels: u16,
}

impl WasapiCapture {
    pub fn new(endpoint_id: String, latest_frame: Arc<Mutex<Option<AnalysisFrame>>>) -> Self {
        Self {
            _endpoint_id: endpoint_id,
            is_running: Arc::new(AtomicBool::new(false)),
            latest_frame,
            thread_handle: None,
            sample_rate: 48000,
            channels: 2,
        }
    }

    pub fn start(&mut self) -> Result<(), String> {
        if self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.is_running.store(true, Ordering::SeqCst);
        let is_running = self.is_running.clone();
        let latest_frame = self.latest_frame.clone();
        let session_id = format!(
            "wasapi-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        );

        let handle = thread::Builder::new()
            .name("resona-wasapi-capture".into())
            .spawn(move || {
                #[cfg(windows)]
                unsafe {
                    let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

                    let enumerator: IMMDeviceEnumerator = match CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) {
                        Ok(e) => e,
                        Err(err) => {
                            log::error!("WASAPI: CoCreateInstance MMDeviceEnumerator failed: {:?}", err);
                            CoUninitialize();
                            return;
                        }
                    };

                    let device: IMMDevice = match enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
                        Ok(d) => d,
                        Err(err) => {
                            log::error!("WASAPI: GetDefaultAudioEndpoint failed: {:?}", err);
                            CoUninitialize();
                            return;
                        }
                    };

                    let audio_client: IAudioClient = match device.Activate(CLSCTX_ALL, None) {
                        Ok(c) => c,
                        Err(err) => {
                            log::error!("WASAPI: device.Activate IAudioClient failed: {:?}", err);
                            CoUninitialize();
                            return;
                        }
                    };

                    let mix_format_ptr: *mut WAVEFORMATEX = match audio_client.GetMixFormat() {
                        Ok(f) => f,
                        Err(err) => {
                            log::error!("WASAPI: GetMixFormat failed: {:?}", err);
                            CoUninitialize();
                            return;
                        }
                    };

                    let mix_format = &*mix_format_ptr;
                    let sample_rate = mix_format.nSamplesPerSec;
                    let channels = mix_format.nChannels as usize;
                    let bits_per_sample = mix_format.wBitsPerSample;

                    log::info!(
                        "WASAPI Loopback started: {} Hz, {} channels, {} bits",
                        sample_rate,
                        channels,
                        bits_per_sample
                    );

                    // Initialize stream in shared loopback mode with 100ms buffer
                    if let Err(err) = audio_client.Initialize(
                        AUDCLNT_SHAREMODE_SHARED,
                        AUDCLNT_STREAMFLAGS_LOOPBACK,
                        1_000_000, // 100ms in 100ns units
                        0,
                        mix_format_ptr,
                        None,
                    ) {
                        log::error!("WASAPI: audio_client.Initialize loopback failed: {:?}", err);
                        CoTaskMemFree(Some(mix_format_ptr as *const _));
                        CoUninitialize();
                        return;
                    }

                    let capture_client: IAudioCaptureClient = match audio_client.GetService() {
                        Ok(c) => c,
                        Err(err) => {
                            log::error!("WASAPI: GetService IAudioCaptureClient failed: {:?}", err);
                            CoTaskMemFree(Some(mix_format_ptr as *const _));
                            CoUninitialize();
                            return;
                        }
                    };

                    if let Err(err) = audio_client.Start() {
                        log::error!("WASAPI: audio_client.Start failed: {:?}", err);
                        CoTaskMemFree(Some(mix_format_ptr as *const _));
                        CoUninitialize();
                        return;
                    }

                    let mut dsp = DspEngine::new(sample_rate);
                    let mut seq = 0u64;
                    let mut last_emit = Instant::now();

                    while is_running.load(Ordering::SeqCst) {
                        thread::sleep(Duration::from_millis(5));

                        while let Ok(packet_size) = capture_client.GetNextPacketSize() {
                            if packet_size == 0 {
                                break;
                            }
                            let mut data_ptr: *mut u8 = std::ptr::null_mut();
                            let mut frames_read = 0u32;
                            let mut flags = 0u32;

                            if capture_client
                                .GetBuffer(&mut data_ptr, &mut frames_read, &mut flags, None, None)
                                .is_ok()
                            {
                                if frames_read > 0 && !data_ptr.is_null() {
                                    let total_samples = frames_read as usize * channels;
                                    let mut float_samples = vec![0.0f32; total_samples];

                                    // AUDCLNT_BUFFERFLAGS_SILENT = 0x2
                                    if (flags & 2) != 0 {
                                        // Silent
                                    } else if bits_per_sample == 32 {
                                        let raw = std::slice::from_raw_parts(
                                            data_ptr as *const f32,
                                            total_samples,
                                        );
                                        DspEngine::decode_float32(raw, &mut float_samples);
                                    } else if bits_per_sample == 16 {
                                        let raw = std::slice::from_raw_parts(
                                            data_ptr as *const i16,
                                            total_samples,
                                        );
                                        DspEngine::decode_pcm16(raw, &mut float_samples);
                                    }

                                    let dt_chunk = (frames_read as f32) / (sample_rate as f32);
                                    dsp.ingest_samples(&float_samples, channels, dt_chunk);
                                }
                                let _ = capture_client.ReleaseBuffer(frames_read);
                            }
                        }

                        // Generate analysis frame at ~60fps
                        if last_emit.elapsed() >= Duration::from_millis(16) {
                            let dt = last_emit.elapsed().as_secs_f32();
                            last_emit = Instant::now();
                            seq += 1;
                            let frame = dsp.generate_frame(seq, &session_id, dt);
                            *latest_frame.lock().unwrap() = Some(frame);
                        }
                    }

                    let _ = audio_client.Stop();
                    CoTaskMemFree(Some(mix_format_ptr as *const _));
                    CoUninitialize();
                }
            })
            .map_err(|e| e.to_string())?;

        self.thread_handle = Some(handle);
        Ok(())
    }

    pub fn stop(&mut self) {
        self.is_running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
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
    latest_frame: Arc<Mutex<Option<AnalysisFrame>>>,
    retry_count: u32,
    _last_event_time: Option<Instant>,
    capture_mode: CaptureMode,
}

impl AudioSupervisor {
    pub fn new() -> Self {
        let latest_frame = Arc::new(Mutex::new(None));
        Self {
            current_capture: None,
            latest_frame,
            retry_count: 0,
            _last_event_time: None,
            capture_mode: CaptureMode::Off,
        }
    }

    pub fn get_latest_frame(&self) -> Option<AnalysisFrame> {
        self.latest_frame.lock().unwrap().clone()
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
        let mut capture = WasapiCapture::new(ep, self.latest_frame.clone());
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

