pub mod bands;
pub mod fft;
pub mod transient;

use crate::types::{AnalysisFrame, AudioActivityState};
use bands::BandFilterbank;
use fft::{Fft2048, FFT_SIZE, NUM_BINS};
use transient::TransientDetector;

pub struct DspEngine {
    sample_rate: u32,
    fft: Fft2048,
    filterbank: BandFilterbank,
    transient_detector: TransientDetector,

    // PCM input accumulation buffer
    pcm_buffer: [f32; FFT_SIZE],
    pcm_write_pos: usize,

    // Activity state tracking
    activity_state: AudioActivityState,
    above_entry_duration_sec: f32,
    below_exit_duration_sec: f32,

    // Smoothed RMS
    smoothed_rms: f32,
    smoothed_peak: f32,
}

impl DspEngine {
    pub fn new(sample_rate: u32) -> Self {
        let updates_per_sec = (sample_rate / fft::HOP_SIZE as u32).max(60) as usize;
        Self {
            sample_rate,
            fft: Fft2048::new(),
            filterbank: BandFilterbank::new(sample_rate as f32),
            transient_detector: TransientDetector::new(updates_per_sec),
            pcm_buffer: [0.0; FFT_SIZE],
            pcm_write_pos: 0,
            activity_state: AudioActivityState::Silent,
            above_entry_duration_sec: 0.0,
            below_exit_duration_sec: 0.0,
            smoothed_rms: 0.0,
            smoothed_peak: 0.0,
        }
    }

    /// Decode raw PCM16 samples: signed integer divided by 32768.0
    pub fn decode_pcm16(raw: &[i16], out: &mut [f32]) {
        for (i, &s) in raw.iter().enumerate().take(out.len()) {
            out[i] = (s as f32) / 32768.0;
        }
    }

    /// Decode raw Float32 samples: nonfinite values replaced with 0.0, finite clamped to [-1.0, 1.0]
    pub fn decode_float32(raw: &[f32], out: &mut [f32]) {
        for (i, &s) in raw.iter().enumerate().take(out.len()) {
            out[i] = if s.is_finite() { s.clamp(-1.0, 1.0) } else { 0.0 };
        }
    }

    /// Compute mean channel power and RMS per SDD Section 6.1:
    /// power = sum(x[channel, frame]^2) / (channels * frames); rms = sqrt(power)
    pub fn compute_rms(samples: &[f32], channels: usize) -> (f32, f32) {
        if samples.is_empty() || channels == 0 {
            return (0.0, -180.0);
        }

        let mut sum_sq = 0.0f64;
        let mut peak = 0.0f32;

        for &s in samples {
            let abs_s = s.abs();
            if abs_s > peak {
                peak = abs_s;
            }
            sum_sq += (s as f64) * (s as f64);
        }

        let power = (sum_sq / (samples.len() as f64)) as f32;
        let rms = power.sqrt();
        let dbfs = 20.0 * (rms.max(1e-9)).log10();
        (rms, dbfs)
    }

    /// Ingest decoded audio frames (mono or stereo interleaved)
    pub fn ingest_samples(&mut self, samples: &[f32], channels: usize, dt: f32) {
        if samples.is_empty() {
            return;
        }

        let (rms, dbfs) = Self::compute_rms(samples, channels);

        // Activity Hysteresis state machine per SDD Section 6.1:
        // Compare at -60 dBFS for entry and -66 dBFS for exit.
        // 500 ms continuous duration for entry, 2.0s continuous duration for exit.
        if dbfs >= -60.0 {
            self.above_entry_duration_sec += dt;
            self.below_exit_duration_sec = 0.0;
            if self.above_entry_duration_sec >= 0.500 {
                self.activity_state = AudioActivityState::Active;
            }
        } else if dbfs <= -66.0 {
            self.below_exit_duration_sec += dt;
            self.above_entry_duration_sec = 0.0;
            if self.below_exit_duration_sec >= 2.000 {
                self.activity_state = AudioActivityState::Silent;
            }
        } else {
            // Hysteresis middle band: retain prior state and reset pending timers
            self.above_entry_duration_sec = 0.0;
            self.below_exit_duration_sec = 0.0;
        }

        // Downmix to mono for FFT buffer
        let num_frames = samples.len() / channels;
        for i in 0..num_frames {
            let mono_sample = if channels == 1 {
                samples[i]
            } else {
                // Mean power preservation
                (samples[i * channels] + samples[i * channels + 1]) * 0.5
            };

            self.pcm_buffer[self.pcm_write_pos] = mono_sample;
            self.pcm_write_pos = (self.pcm_write_pos + 1) % FFT_SIZE;
        }

        // Exponential smoothing for RMS & Peak (attack 30ms, release 250ms)
        let tau_rms = if rms > self.smoothed_rms { 0.030 } else { 0.250 };
        self.smoothed_rms += (1.0 - (-dt / tau_rms).exp()) * (rms - self.smoothed_rms);

        let (_, peak_val) = Self::compute_rms(samples, channels);
        let tau_peak = if peak_val > self.smoothed_peak { 0.030 } else { 0.250 };
        self.smoothed_peak += (1.0 - (-dt / tau_peak).exp()) * (peak_val - self.smoothed_peak);
    }

    /// Process accumulated PCM buffer through FFT and generate an AnalysisFrame
    pub fn generate_frame(&mut self, sequence: u64, session_id: &str, dt: f32) -> AnalysisFrame {
        let mut ordered_pcm = [0.0f32; FFT_SIZE];
        for i in 0..FFT_SIZE {
            let idx = (self.pcm_write_pos + i) % FFT_SIZE;
            ordered_pcm[i] = self.pcm_buffer[idx];
        }

        let mut psd = [0.0f32; NUM_BINS];
        self.fft.compute_one_sided_psd(&ordered_pcm, &mut psd);

        let (bands, bass, mid, treble) = self.filterbank.compute_bands(&psd, dt);

        let dbfs = 20.0 * (self.smoothed_rms.max(1e-9)).log10();
        let (transient_counter, transient_strength) =
            self.transient_detector.process(&psd, dbfs, dt);

        AnalysisFrame {
            schema_version: 1,
            session_id: session_id.to_string(),
            sequence,
            captured_at_us: 0,
            sample_rate_hz: self.sample_rate,
            bands: bands.to_vec(),
            rms: self.smoothed_rms,
            peak: self.smoothed_peak,
            bass,
            mid,
            treble,
            transient_counter,
            transient_strength,
            activity: self.activity_state,
            discontinuity: false,
        }
    }

    pub fn reset_history(&mut self) {
        self.pcm_buffer = [0.0; FFT_SIZE];
        self.pcm_write_pos = 0;
        self.filterbank.reset();
        self.transient_detector.reset();
        self.above_entry_duration_sec = 0.0;
        self.below_exit_duration_sec = 0.0;
        self.smoothed_rms = 0.0;
        self.smoothed_peak = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    #[test]
    fn test_pcm16_decoding_fixture() {
        // SDD fixture: PCM16 min (-32768), zero (0), max (32767)
        let raw = [-32768i16, 0i16, 32767i16];
        let mut out = [0.0f32; 3];
        DspEngine::decode_pcm16(&raw, &mut out);

        assert!((out[0] - (-1.0)).abs() < 1e-7);
        assert!((out[1] - 0.0).abs() < 1e-7);
        assert!((out[2] - (32767.0 / 32768.0)).abs() < 1e-7);
    }

    #[test]
    fn test_float_nonfinite_fixture() {
        // SDD fixture: Float nonfinite replaced with zero, clamped to [-1, 1]
        let raw = [f32::NAN, f32::INFINITY, f32::NEG_INFINITY, 1.5, -2.0, 0.5];
        let mut out = [0.0f32; 6];
        DspEngine::decode_float32(&raw, &mut out);

        assert_eq!(out[0], 0.0);
        assert_eq!(out[1], 0.0);
        assert_eq!(out[2], 0.0);
        assert_eq!(out[3], 1.0);
        assert_eq!(out[4], -1.0);
        assert_eq!(out[5], 0.5);
    }

    #[test]
    fn test_mono_sinusoid_rms_fixture() {
        // SDD fixture: Mono sinusoid, peak 0.5 -> RMS over 1s = 0.353553 within 0.001; dBFS about -9.0309 within 0.05 dB
        let sample_rate = 48000;
        let freq = 1000.0;
        let mut samples = vec![0.0f32; sample_rate];

        for i in 0..sample_rate {
            samples[i] = 0.5 * (2.0 * PI * freq * (i as f32) / (sample_rate as f32)).sin();
        }

        let (rms, dbfs) = DspEngine::compute_rms(&samples, 1);
        let expected_rms = 0.5 / 2.0f32.sqrt(); // 0.35355339
        assert!((rms - expected_rms).abs() < 0.001, "RMS was {}", rms);
        assert!((dbfs - (-9.0309)).abs() < 0.05, "dBFS was {}", dbfs);
    }

    #[test]
    fn test_stereo_opposite_phase_power_preservation() {
        // SDD fixture: stereo sinusoid with one channel inverted
        // RMS must differ from same-phase by <= 1e-6
        let sample_rate = 48000;
        let freq = 440.0;
        let mut stereo_normal = vec![0.0f32; sample_rate * 2];
        let mut stereo_inverted = vec![0.0f32; sample_rate * 2];

        for i in 0..sample_rate {
            let s = 0.5 * (2.0 * PI * freq * (i as f32) / (sample_rate as f32)).sin();
            stereo_normal[i * 2] = s;
            stereo_normal[i * 2 + 1] = s;

            stereo_inverted[i * 2] = s;
            stereo_inverted[i * 2 + 1] = -s; // Inverted channel
        }

        let (rms_normal, _) = DspEngine::compute_rms(&stereo_normal, 2);
        let (rms_inverted, _) = DspEngine::compute_rms(&stereo_inverted, 2);

        assert!((rms_normal - rms_inverted).abs() <= 1e-6);
    }

    #[test]
    fn test_activity_hysteresis_state_machine() {
        let mut engine = DspEngine::new(48000);
        let sample_chunk = vec![0.0f32; 480]; // 10ms chunk

        // Step 1: Silent input
        engine.ingest_samples(&sample_chunk, 1, 0.010);
        assert_eq!(engine.activity_state, AudioActivityState::Silent);

        // Step 2: Signal above -60 dBFS (e.g. -50 dBFS, peak ~0.01) for 400ms -> should still be silent (< 500ms)
        let active_sample = vec![0.01f32; 480];
        for _ in 0..40 {
            engine.ingest_samples(&active_sample, 1, 0.010);
        }
        assert_eq!(engine.activity_state, AudioActivityState::Silent);

        // Feed for another 15 iterations (total 550ms > 500ms) -> must transition to Active!
        for _ in 0..15 {
            engine.ingest_samples(&active_sample, 1, 0.010);
        }
        assert_eq!(engine.activity_state, AudioActivityState::Active);
    }
}
