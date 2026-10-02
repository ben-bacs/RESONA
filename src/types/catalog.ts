import { PresetMetadata } from "./contracts";

export const LAUNCH_PRESETS: PresetMetadata[] = [
  {
    id: "pulse_ring",
    name: "Pulse Ring",
    collection: "Minimal",
    description: "Frequency bands expand a circular spectrum with radiant harmonics.",
    defaultParameters: {
      brightness: 0.85,
      sensitivity: 1.0,
      motionSpeed: 1.0,
      colorPalette: "neon_violet",
      bloomIntensity: 0.6,
      presetSpecific: {
        ringWidthPx: 3,
        glow: 0.35,
      },
    },
  },
  {
    id: "silk_wave",
    name: "Silk Wave",
    collection: "Minimal",
    description: "Loudness and spectral balance shape flowing layered ribbons.",
    defaultParameters: {
      brightness: 0.8,
      sensitivity: 1.0,
      motionSpeed: 0.9,
      colorPalette: "oceanic_azure",
      bloomIntensity: 0.5,
      presetSpecific: {
        layers: 3,
        lineWidthPx: 2,
      },
    },
  },
  {
    id: "star_drift",
    name: "Star Drift",
    collection: "Cosmic",
    description: "Bass drives warp velocity; high frequencies stimulate sparkling constellations.",
    defaultParameters: {
      brightness: 0.9,
      sensitivity: 1.1,
      motionSpeed: 1.2,
      colorPalette: "deep_cosmos",
      bloomIntensity: 0.7,
      presetSpecific: {
        density: 0.5,
        travelSpeed: 0.2,
      },
    },
  },
  {
    id: "neon_highway",
    name: "Neon Highway",
    collection: "Vibrant",
    description: "Retro-futuristic perspective grid illuminated by basslines and mid contours.",
    defaultParameters: {
      brightness: 0.9,
      sensitivity: 1.0,
      motionSpeed: 1.1,
      colorPalette: "synthwave",
      bloomIntensity: 0.8,
      presetSpecific: {
        gridLines: 24,
        horizonGlow: 0.4,
      },
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    collection: "Atmospheric",
    description: "Layered procedural fluid curtains undulating to musical dynamics.",
    defaultParameters: {
      brightness: 0.75,
      sensitivity: 0.9,
      motionSpeed: 0.8,
      colorPalette: "boreal_glow",
      bloomIntensity: 0.4,
      presetSpecific: {
        curtainCount: 4,
        flowSpeed: 0.1,
      },
    },
  },
  {
    id: "ripple",
    name: "Ripple",
    collection: "Minimal",
    description: "Geometric water-surface reflections echoing every transient beat.",
    defaultParameters: {
      brightness: 0.8,
      sensitivity: 1.0,
      motionSpeed: 1.0,
      colorPalette: "monochrome_silver",
      bloomIntensity: 0.3,
      presetSpecific: {
        decaySeconds: 2.0,
        ringWidthPx: 2.0,
      },
    },
  },
  {
    id: "prism",
    name: "Prism",
    collection: "Vibrant",
    description: "Multi-fold crystalline kaleidoscopic refractions responsive to harmonic balance.",
    defaultParameters: {
      brightness: 0.85,
      sensitivity: 1.0,
      motionSpeed: 1.0,
      colorPalette: "chromatic_prism",
      bloomIntensity: 0.7,
      presetSpecific: {
        symmetry: 6,
        rotationDegPerSec: 6.0,
      },
    },
  },
  {
    id: "shockwave",
    name: "Shockwave",
    collection: "Cosmic",
    description: "Dynamic radial shockwaves and energetic particle bursts triggered by percussion.",
    defaultParameters: {
      brightness: 0.95,
      sensitivity: 1.2,
      motionSpeed: 1.3,
      colorPalette: "solar_flare",
      bloomIntensity: 0.85,
      presetSpecific: {
        burstParticles: 64,
        decaySeconds: 0.8,
      },
    },
  },
];
