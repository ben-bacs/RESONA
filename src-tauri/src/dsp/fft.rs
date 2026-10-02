use std::f32::consts::PI;

pub const FFT_SIZE: usize = 2048;
pub const HOP_SIZE: usize = 512;
pub const NUM_BINS: usize = FFT_SIZE / 2 + 1; // 1025 one-sided bins

pub struct Fft2048 {
    hann_window: [f32; FFT_SIZE],
    window_energy_sum: f32,
    bit_rev: [usize; FFT_SIZE],
}

impl Fft2048 {
    pub fn new() -> Self {
        let mut hann_window = [0.0f32; FFT_SIZE];
        let mut window_energy_sum = 0.0f32;

        for n in 0..FFT_SIZE {
            // Periodic Hann window: w[n] = 0.5 - 0.5 * cos(2 * pi * n / N)
            let w = 0.5 - 0.5 * (2.0 * PI * (n as f32) / (FFT_SIZE as f32)).cos();
            hann_window[n] = w;
            window_energy_sum += w * w;
        }

        let mut bit_rev = [0usize; FFT_SIZE];
        let bits = (FFT_SIZE as f32).log2() as usize;
        for i in 0..FFT_SIZE {
            let mut rev = 0;
            for j in 0..bits {
                if (i & (1 << j)) != 0 {
                    rev |= 1 << (bits - 1 - j);
                }
            }
            bit_rev[i] = rev;
        }

        Self {
            hann_window,
            window_energy_sum,
            bit_rev,
        }
    }

    pub fn window(&self) -> &[f32; FFT_SIZE] {
        &self.hann_window
    }

    pub fn window_energy_sum(&self) -> f32 {
        self.window_energy_sum
    }

    /// In-place Radix-2 Decimation-in-Time FFT
    pub fn compute_one_sided_psd(
        &self,
        input: &[f32; FFT_SIZE],
        psd_out: &mut [f32; NUM_BINS],
    ) {
        let mut real = [0.0f32; FFT_SIZE];
        let mut imag = [0.0f32; FFT_SIZE];

        // Apply Hann window and bit-reversal permutation
        for i in 0..FFT_SIZE {
            let rev_idx = self.bit_rev[i];
            real[i] = input[rev_idx] * self.hann_window[rev_idx];
            imag[i] = 0.0;
        }

        // Cooley-Tukey butterfly computations
        let mut len = 2;
        while len <= FFT_SIZE {
            let half = len / 2;
            let angle_step = -2.0 * PI / (len as f32);

            let mut w_real = 1.0f32;
            let mut w_imag = 0.0f32;
            let w_step_real = angle_step.cos();
            let w_step_imag = angle_step.sin();

            for j in 0..half {
                for i in (j..FFT_SIZE).step_by(len) {
                    let u_real = real[i];
                    let u_imag = imag[i];

                    let v_real = real[i + half] * w_real - imag[i + half] * w_imag;
                    let v_imag = real[i + half] * w_imag + imag[i + half] * w_real;

                    real[i] = u_real + v_real;
                    imag[i] = u_imag + v_imag;
                    real[i + half] = u_real - v_real;
                    imag[i + half] = u_imag - v_imag;
                }

                // Advance twiddle factor
                let next_w_real = w_real * w_step_real - w_imag * w_step_imag;
                let next_w_imag = w_real * w_step_imag + w_imag * w_step_real;
                w_real = next_w_real;
                w_imag = next_w_imag;
            }

            len <<= 1;
        }

        // Compute one-sided power spectrum P[k] = factor[k] * |X[k]|^2 / (N * sum(w[n]^2))
        let norm_factor = (FFT_SIZE as f32) * self.window_energy_sum;
        for k in 0..NUM_BINS {
            let mag_sq = real[k] * real[k] + imag[k] * imag[k];
            let factor = if k == 0 || k == FFT_SIZE / 2 { 1.0 } else { 2.0 };
            psd_out[k] = factor * mag_sq / norm_factor;
        }
    }
}
