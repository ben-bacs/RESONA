use crate::dsp::fft::{FFT_SIZE, NUM_BINS};

pub const NUM_BANDS: usize = 64;

pub struct BandFilterbank {
    _sample_rate: f32,
    edges: [f32; NUM_BANDS + 1],
    // For each bin, list of (band_idx, weight)
    bin_weights: Vec<Vec<(usize, f32)>>,
    // Smoothed values
    smoothed_bands: [f32; NUM_BANDS],
    smoothed_bass: f32,
    smoothed_mid: f32,
    smoothed_treble: f32,
}

impl BandFilterbank {
    pub fn new(sample_rate: f32) -> Self {
        let nyquist = sample_rate / 2.0;
        let max_freq = 20000.0f32.min(nyquist);
        let min_freq = 20.0f32;

        let mut edges = [0.0f32; NUM_BANDS + 1];
        let log_min = min_freq.ln();
        let log_max = max_freq.ln();
        let log_step = (log_max - log_min) / (NUM_BANDS as f32);

        for i in 0..=NUM_BANDS {
            edges[i] = (log_min + (i as f32) * log_step).exp();
        }

        let bin_width = sample_rate / (FFT_SIZE as f32);
        let mut bin_weights: Vec<Vec<(usize, f32)>> = vec![Vec::new(); NUM_BINS];

        for k in 1..NUM_BINS {
            let bin_start = (k as f32 - 0.5) * bin_width;
            let bin_end = (k as f32 + 0.5) * bin_width;

            for b in 0..NUM_BANDS {
                let band_start = edges[b];
                let band_end = edges[b + 1];

                let overlap_start = bin_start.max(band_start);
                let overlap_end = bin_end.min(band_end);

                if overlap_end > overlap_start {
                    let weight = (overlap_end - overlap_start) / bin_width;
                    bin_weights[k].push((b, weight));
                }
            }
        }

        Self {
            _sample_rate: sample_rate,
            edges,
            bin_weights,
            smoothed_bands: [0.0; NUM_BANDS],
            smoothed_bass: 0.0,
            smoothed_mid: 0.0,
            smoothed_treble: 0.0,
        }
    }

    pub fn compute_bands(
        &mut self,
        psd: &[f32; NUM_BINS],
        dt: f32,
    ) -> ([f32; NUM_BANDS], f32, f32, f32) {
        let mut raw_bands = [0.0f32; NUM_BANDS];

        for k in 1..NUM_BINS {
            let power = psd[k];
            for &(b, w) in &self.bin_weights[k] {
                raw_bands[b] += power * w;
            }
        }

        // Aggregate raw powers for bass (20-250Hz), mid (250-4000Hz), treble (4000Hz-max)
        let mut raw_bass = 0.0f32;
        let mut raw_mid = 0.0f32;
        let mut raw_treble = 0.0f32;

        for b in 0..NUM_BANDS {
            let center_freq = (self.edges[b] + self.edges[b + 1]) * 0.5;
            let p = raw_bands[b];
            if center_freq <= 250.0 {
                raw_bass += p;
            } else if center_freq <= 4000.0 {
                raw_mid += p;
            } else {
                raw_treble += p;
            }
        }

        // Normalization per SDD Section 6.2: clamp((10*log10(max(B, 1e-12)) + 80) / 80, 0, 1)
        let normalize = |power: f32| -> f32 {
            let db = 10.0 * power.max(1e-12).log10();
            ((db + 80.0) / 80.0).clamp(0.0, 1.0)
        };

        let mut normalized_bands = [0.0f32; NUM_BANDS];
        for b in 0..NUM_BANDS {
            let target = normalize(raw_bands[b]);
            // Attack (30ms), Release (250ms) smoothing
            let tau = if target > self.smoothed_bands[b] { 0.030 } else { 0.250 };
            let alpha = 1.0 - (-dt / tau).exp();
            self.smoothed_bands[b] += alpha * (target - self.smoothed_bands[b]);
            normalized_bands[b] = self.smoothed_bands[b];
        }

        let target_bass = normalize(raw_bass);
        let tau_bass = if target_bass > self.smoothed_bass { 0.030 } else { 0.250 };
        self.smoothed_bass += (1.0 - (-dt / tau_bass).exp()) * (target_bass - self.smoothed_bass);

        let target_mid = normalize(raw_mid);
        let tau_mid = if target_mid > self.smoothed_mid { 0.030 } else { 0.250 };
        self.smoothed_mid += (1.0 - (-dt / tau_mid).exp()) * (target_mid - self.smoothed_mid);

        let target_treble = normalize(raw_treble);
        let tau_treble = if target_treble > self.smoothed_treble { 0.030 } else { 0.250 };
        self.smoothed_treble += (1.0 - (-dt / tau_treble).exp()) * (target_treble - self.smoothed_treble);

        (
            normalized_bands,
            self.smoothed_bass,
            self.smoothed_mid,
            self.smoothed_treble,
        )
    }

    pub fn reset(&mut self) {
        self.smoothed_bands = [0.0; NUM_BANDS];
        self.smoothed_bass = 0.0;
        self.smoothed_mid = 0.0;
        self.smoothed_treble = 0.0;
    }
}
