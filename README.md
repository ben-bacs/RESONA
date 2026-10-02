# RESONA 

> **Music-Reactive Idle Visualizer for Windows 11**

RESONA is a lightweight, ambient desktop application engineered for Windows 11 that turns an idle laptop or desktop into a responsive, full-screen music visualizer. It operates entirely locally using native Windows WASAPI loopback audio capture, zero cloud dependencies, and decoupled, hardware-accelerated WebGL2 shaders.

---

##  Core Architecture

- **Native Core**: [Tauri 2.2](https://v2.tauri.app/) + [Rust](https://www.rust-lang.org/)
- **Audio Capture**: Direct Windows WASAPI loopback capture (`windows` crate) — zero microphone permissions needed, capturing exact speaker playback.
- **DSP Engine**: Real-time 64-band logarithmic FFT filterbank, Hann windowing, RMS channel power computation with -60/-66 dBFS activity hysteresis, and adaptive transient onset detection in native Rust.
- **Frontend / Settings**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Visualizer Engine**: Standalone high-performance [WebGL2](https://www.khronos.org/webgl/) runtime completely decoupled from the React rendering loop, supporting 60 FPS / 30 FPS power throttling.
- **Persistence**: Atomic filesystem transactions (`.tmp` write, sync, replace with `.bak` rollback, and `.corrupt` quarantining) with monotonic revision counters preventing optimistic concurrency race conditions.

---

##  Launch Scenes Collection (8 Presets)

RESONA includes eight launch WebGL2 scenes, each tailored with distinct audio reaction mappings, trusted color palettes, and quality-tier parameter ceilings (Low, Balanced, High):

1. **Pulse Ring** (*Minimal*): Frequency bands expand a circular spectrum with radiant harmonics, stroke width, and halo glow tuning.
2. **Silk Wave** (*Minimal*): Spectral envelopes drive flowing layered ribbon strips with phase-offset curves and silence damping.
3. **Star Drift** (*Cosmic*): Bass drives warp velocity while high frequencies stimulate sparkling constellations using recycled star particles (capped at 4096 on High, 2048 Balanced, 512 Low).
4. **Neon Highway** (*Vibrant*): Retro-futuristic perspective grid terrain and horizon synthwave sun undulating to basslines and mid contours.
5. **Aurora** (*Atmospheric*): Multi-layered procedural fluid curtains undulating to musical dynamics with green-to-violet gradients.
6. **Ripple** (*Minimal*): Concentric water-surface reflections echoing transient percussion beats using pooled radial distance fields (capped at 64 on High, 32 Balanced, 16 Low).
7. **Prism** (*Vibrant*): Multi-fold kaleidoscopic rotational symmetry folding with signed angular velocity.
8. **Shockwave** (*Cosmic*): Expanding wavefront distortion rings and instanced burst spark particles triggered by percussive onsets.

---

## 💾 Personalization, Variations & Smart Shuffler

- **User Variations**: Create, update, rename, and delete custom named variations (up to 500 records) with native Windows UUID identifiers.
- **Inert Import / Export**: Safe portability with strict UTF-8 JSON validation (denying unknown fields, scripts, or paths, capped at 64 KB and 8 container levels). Tokenized 5-minute single-use review dialog before persisting.
- **Smart Fullscreen Shuffler**: Configurable 1–30 minute interval timer that automatically rotates across favorites or selected variations without immediate repetition, pausing gracefully when fullscreen is not visible.

---

##  Getting Started

### Prerequisites

- **OS**: Windows 11 x64
- **Rust**: `1.78+` (`rustup default stable`)
- **Node.js**: `v18+` or `v20+` / `v22+`
- **Visual Studio C++ Build Tools** (for compiling native Windows components)

### Setup & Development

```powershell
# Clone the repository
git clone https://github.com/ben-bacs/RESONA.git
cd RESONA

# Install frontend dependencies
npm install

# Run frontend unit & type check
npm run build

# Run native Rust unit tests (18 tests)
$env:CARGO_TARGET_DIR = "$env:USERPROFILE\.cargo-target\resona"
cargo test --manifest-path src-tauri/Cargo.toml

# Launch desktop app in development mode
npm run tauri dev
```

---

##  Deployment & Releases

Automated distribution is configured through **GitHub Actions** workflows targeting **GitHub Releases**:
- **NSIS (`.exe`)** and **WiX (`.msi`)** standalone installers are compiled on `windows-latest` runners for tag pushes (`v*`).
- Cryptographic SHA-256 checksums and automated release notes accompany every tag.
- In-app automatic updates are provided via Tauri v2's built-in updater manifest.

---

##  License

MIT License. See [LICENSE](LICENSE) for details.
