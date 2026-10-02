use crate::dsp::fft::NUM_BINS;

pub struct TransientDetector {
    prev_amplitudes: [f32; NUM_BINS],
    flux_history: Vec<f32>,
    history_capacity: usize, // 1 second of history
    history_len: usize,
    history_idx: usize,
    last_event_time_sec: f32,
    current_time_sec: f32,
    monotonic_counter: u64,
}

impl TransientDetector {
    pub fn new(updates_per_second: usize) -> Self {
        let capacity = updates_per_second.max(10);
        Self {
            prev_amplitudes: [0.0; NUM_BINS],
            flux_history: vec![0.0; capacity],
            history_capacity: capacity,
            history_len: 0,
            history_idx: 0,
            last_event_time_sec: -1.0,
            current_time_sec: 0.0,
            monotonic_counter: 0,
        }
    }

    pub fn process(
        &mut self,
        psd: &[f32; NUM_BINS],
        rms_dbfs: f32,
        dt: f32,
    ) -> (u64, f32) {
        self.current_time_sec += dt;

        // Calculate positive spectral difference
        let mut diff_sum = 0.0f32;
        let mut prev_sum = 0.0f32;

        for k in 1..NUM_BINS {
            let amp = psd[k].max(0.0).sqrt();
            let prev = self.prev_amplitudes[k];
            let diff = amp - prev;
            if diff > 0.0 {
                diff_sum += diff;
            }
            prev_sum += prev;
            self.prev_amplitudes[k] = amp;
        }

        let flux = diff_sum / (prev_sum + 1e-9);

        // Calculate mean and stddev of flux history before inserting new observation
        let mut _triggered = false;
        let mut strength = 0.0f32;

        // SDD: requires at least 100ms of history
        let min_history_items = (self.history_capacity / 10).max(5);
        if self.history_len >= min_history_items {
            let mut sum = 0.0f32;
            let count = self.history_len as f32;
            for i in 0..self.history_len {
                sum += self.flux_history[i];
            }
            let mean = sum / count;

            let mut variance_sum = 0.0f32;
            for i in 0..self.history_len {
                let diff = self.flux_history[i] - mean;
                variance_sum += diff * diff;
            }
            let stddev = (variance_sum / count).sqrt();

            let threshold = 0.05f32.max(mean + 2.0 * stddev);
            let refractory_satisfied = (self.current_time_sec - self.last_event_time_sec) >= 0.150;
            let rms_satisfied = rms_dbfs >= -60.0;

            if flux > threshold && refractory_satisfied && rms_satisfied {
                _triggered = true;
                self.monotonic_counter += 1;
                self.last_event_time_sec = self.current_time_sec;
                strength = ((flux - threshold) / threshold.max(0.05)).clamp(0.0, 1.0);
            }
        }

        // Insert into history ring
        self.flux_history[self.history_idx] = flux;
        self.history_idx = (self.history_idx + 1) % self.history_capacity;
        if self.history_len < self.history_capacity {
            self.history_len += 1;
        }

        (self.monotonic_counter, strength)
    }

    pub fn reset(&mut self) {
        self.prev_amplitudes = [0.0; NUM_BINS];
        self.history_len = 0;
        self.history_idx = 0;
        self.last_event_time_sec = -1.0;
    }
}
