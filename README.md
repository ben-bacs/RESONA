# RESONA 🌌🎵

> **Music-Reactive Idle Visualizer for Windows 11**

RESONA is a lightweight, ambient desktop application engineered for Windows 11 that turns an idle laptop into a responsive, full-screen music visualizer. It operates entirely locally using native WASAPI loopback audio capture, zero cloud dependencies, and hardware-accelerated WebGL2 scenes.

---

## ⚡ Core Architecture

- **Native Core**: [Tauri 2](https://v2.tauri.app/) + [Rust](https://www.rust-lang.org/)
- **Audio Capture**: Direct Windows WASAPI loopback capture (`windows` crate) — zero microphone permissions needed.
- **DSP Engine**: Real-time 64-band logarithmic FFT, Hann windowing, RMS loudness calculation, and adaptive transient detection in native Rust.
- **Frontend / Settings**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Visualizer Engine**: Standalone high-performance [WebGL2](https://www.khronos.org/webgl/) runtime completely decoupled from the React rendering loop.

---

## 🚀 Getting Started

### Prerequisites

- **OS**: Windows 11 x64
- **Rust**: `1.78+` (`rustup default stable`)
- **Node.js**: `v18+` or `v20+` / `v24+`
- **Visual Studio C++ Build Tools** (for compiling native Windows components)

### Setup

```bash
# Clone the repository
git clone https://github.com/ben-bacs/RESONA.git
cd RESONA

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build production Windows release
npm run tauri build
```

---

## 📦 Deployment & Releases

Automated distribution is handled via **GitHub Actions** workflows targeting **GitHub Releases**:
- Windows `.msi` and `.exe` (NSIS) installers are packaged and cryptographically hashed on each version tag (`v*`).
- In-app automatic updates are delivered via Tauri v2's built-in updater connected to the GitHub Releases endpoint.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
