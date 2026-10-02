/**
 * RESONA Architecture Contracts and Data Transfer Objects (DTOs)
 * Defined per RESONA_03_FULL_ARCHITECTURE.md and RESONA_08_SDD.md
 */

export type SceneId =
  | "pulse_ring"
  | "silk_wave"
  | "star_drift"
  | "neon_highway"
  | "aurora"
  | "ripple"
  | "prism"
  | "shockwave";

export type QualityTier = "low" | "medium" | "high";

export type AudioActivityState = "Active" | "Silent" | "Unavailable";

export interface AnalysisFrame {
  schemaVersion: number;
  sessionId: string;
  sequence: number;
  capturedAtUs: number;
  sampleRateHz: number;
  bands: number[]; // 64 logarithmic bands normalized to [0.0, 1.0]
  rms: number;
  peak: number;
  bass: number;
  mid: number;
  treble: number;
  transientCounter: number;
  transientStrength: number;
  activity: AudioActivityState;
  discontinuity: boolean;
}

export interface AppearanceParameters {
  brightness: number; // 0.0 - 1.0
  sensitivity: number; // 0.2 - 3.0
  motionSpeed: number; // 0.2 - 2.0
  colorPalette: string;
  bloomIntensity: number; // 0.0 - 1.0
  presetSpecific?: Record<string, number | string | boolean>;
}

export interface PresetMetadata {
  id: SceneId;
  name: string;
  collection: "Minimal" | "Cosmic" | "Vibrant" | "Atmospheric";
  description: string;
  defaultParameters: AppearanceParameters;
}

export type DisplayMode =
  | "Dormant"
  | "Preview"
  | "OpeningManual"
  | "OpeningAuto"
  | "ManualFullscreen"
  | "AutoFullscreen"
  | "Suspended"
  | "RendererFailed"
  | "Exiting";

export type CaptureMode =
  | "Off"
  | "Starting"
  | "Running"
  | "Recovering"
  | "Unavailable";

export interface RuntimeState {
  display: DisplayMode;
  capture: CaptureMode;
  power: {
    awake: boolean;
    unlocked: boolean;
    displayOn: boolean;
    onBattery: boolean;
  };
  ui: {
    mainVisible: boolean;
    previewRequested: boolean;
    previewPaused: boolean;
    fullscreenVisible: boolean;
  };
  policy: {
    paused: boolean;
    rendererBlocked: boolean;
  };
  selectedPreset: SceneId;
}

export interface AudioEndpoint {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface UserPreferences {
  autoEnabled: boolean;
  idleDelaySec: number;
  audioGateEnabled: boolean;
  selectedPreset: SceneId;
  targetMonitorId?: string;
}

export type LookRef =
  | { kind: "builtin"; scene_id: SceneId }
  | { kind: "variation"; id: string };

export interface PresetVariation {
  id: string;
  name: string;
  sceneId: SceneId;
  appearanceVersion: number;
  appearance: AppearanceParameters;
}

export interface CommittedLook {
  sceneId: SceneId;
  appearanceVersion: number;
  appearance: AppearanceParameters;
  originVariationId?: string;
}

export type ShuffleSource = "favorites" | "selected";

export interface ShuffleConfig {
  enabled: boolean;
  source: ShuffleSource;
  selected: LookRef[];
  intervalMinutes: number;
}

export interface SettingsSnapshot {
  schemaVersion: number;
  revision: number;
  preferences: UserPreferences;
  committedLook: CommittedLook;
  variations: PresetVariation[];
  favorites: LookRef[];
  shuffle: ShuffleConfig;
  onboardingCompleted: boolean;
  closeToTrayExplained: boolean;
}

export interface ImportReviewResponse {
  token: string;
  name: string;
  sceneId: SceneId;
  appearance: AppearanceParameters;
}
