import { IScene } from "./scene-contract";
import { PulseRingScene } from "./scenes/pulse-ring";
import { SilkWaveScene } from "./scenes/silk-wave";
import { StarDriftScene } from "./scenes/star-drift";
import { NeonHighwayScene } from "./scenes/neon-highway";
import { AuroraScene } from "./scenes/aurora";
import { RippleScene } from "./scenes/ripple";
import { PrismScene } from "./scenes/prism";
import { ShockwaveScene } from "./scenes/shockwave";
import { AnalysisFrame, AppearanceParameters, QualityTier, SceneId } from "../types/contracts";

export class SceneManager {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private currentScene: IScene | null = null;
  private currentSceneId: SceneId | null = null;
  private currentParams: AppearanceParameters | undefined;
  private animationFrameId: number | null = null;
  private lastTimestamp = 0;
  private quality: QualityTier = "high";

  private latestAnalysisFrame: AnalysisFrame;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.latestAnalysisFrame = this.createSyntheticFrame(0);
    this.initWebGL();
  }

  private initWebGL() {
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      console.error("WebGL2 is not supported on this device/browser");
      return;
    }
    this.gl = gl;
  }

  private createSceneInstance(sceneId: SceneId): IScene {
    switch (sceneId) {
      case "pulse_ring":
        return new PulseRingScene();
      case "silk_wave":
        return new SilkWaveScene();
      case "star_drift":
        return new StarDriftScene();
      case "neon_highway":
        return new NeonHighwayScene();
      case "aurora":
        return new AuroraScene();
      case "ripple":
        return new RippleScene();
      case "prism":
        return new PrismScene();
      case "shockwave":
        return new ShockwaveScene();
      default:
        return new PulseRingScene();
    }
  }

  public setQuality(quality: QualityTier) {
    if (this.quality === quality) return;
    this.quality = quality;
    if (this.currentSceneId) {
      this.setScene(this.currentSceneId, this.currentParams);
    }
  }

  public setScene(sceneId: SceneId, params?: AppearanceParameters): boolean {
    if (!this.gl) return false;

    // Clean up existing scene
    if (this.currentScene) {
      this.currentScene.dispose();
      this.currentScene = null;
    }

    const scene = this.createSceneInstance(sceneId);

    const success = scene.initialize(this.gl, this.quality);
    if (!success) {
      console.error(`Failed to initialize scene: ${sceneId}`);
      return false;
    }

    this.currentParams = params;
    if (params) {
      scene.applyParameters(params);
    }

    this.currentScene = scene;
    this.currentSceneId = sceneId;
    this.handleResize();
    return true;
  }

  public getCurrentSceneId(): SceneId | null {
    return this.currentSceneId;
  }

  public applyParameters(params: AppearanceParameters) {
    this.currentParams = params;
    if (this.currentScene) {
      this.currentScene.applyParameters(params);
    }
  }

  private lastExternalFrameTime = 0;

  public updateAnalysisFrame(frame: AnalysisFrame) {
    this.latestAnalysisFrame = frame;
    this.lastExternalFrameTime = performance.now();
  }

  public start() {
    if (this.animationFrameId !== null) return;
    this.lastTimestamp = performance.now();
    this.loop(this.lastTimestamp);
  }

  public stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public handleResize() {
    if (!this.gl || !this.currentScene) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.currentScene.resize(width, height, dpr);
  }

  private loop = (timestamp: number) => {
    const deltaMs = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    const deltaSec = Math.min(deltaMs / 1000, 0.05); // Clamp dt to 50ms per SDD Section 9

    // If no real audio frame has been received in 150ms, animate using ambient synthetic motion
    const isExternalStale = (timestamp - this.lastExternalFrameTime) > 150;
    const activeFrame = isExternalStale
      ? this.createSyntheticFrame(timestamp / 1000)
      : this.blendLivingFloor(this.latestAnalysisFrame, timestamp / 1000);

    if (this.currentScene && this.gl) {
      this.currentScene.update(deltaSec, activeFrame);
      this.currentScene.render();
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  public dispose() {
    this.stop();
    if (this.currentScene) {
      this.currentScene.dispose();
      this.currentScene = null;
    }
    this.gl = null;
  }

  /**
   * Blends live audio frames with an organic living ambient floor
   * so visuals are never flat or lifeless, even during quiet acoustic parts.
   */
  public blendLivingFloor(frame: AnalysisFrame, timeSec: number): AnalysisFrame {
    const blendedBands = new Array(64);
    for (let i = 0; i < 64; i++) {
      const ambient = Math.max(0.04, Math.sin(timeSec * 3.0 + i * 0.18) * 0.12 + 0.14);
      blendedBands[i] = Math.max(frame.bands[i] || 0.0, ambient);
    }

    const ambientBeat = Math.pow(Math.max(0.0, Math.sin(timeSec * 2.5)), 4.0) * 0.18;
    const effectiveRms = Math.max(frame.rms, 0.12 + ambientBeat);
    const effectiveBass = Math.max(frame.bass, 0.15 + ambientBeat);
    const effectiveMid = Math.max(frame.mid, 0.10);
    const effectiveTreble = Math.max(frame.treble, 0.08);

    return {
      ...frame,
      bands: blendedBands,
      rms: effectiveRms,
      bass: effectiveBass,
      mid: effectiveMid,
      treble: effectiveTreble,
      activity: "Active",
    };
  }

  /**
   * Generates a dynamic, breathing synthetic ambient analysis frame when native audio loopback is idle
   */
  public createSyntheticFrame(timeSec: number): AnalysisFrame {
    const bands = new Array(64);
    const bassWave = Math.sin(timeSec * 3.2) * 0.35 + 0.45;
    const midWave = Math.sin(timeSec * 4.8 + 1.2) * 0.28 + 0.35;
    const trebleWave = Math.sin(timeSec * 7.5 + 2.4) * 0.22 + 0.30;

    for (let i = 0; i < 64; i++) {
      const localWave = Math.sin(timeSec * 4.0 + i * 0.25) * 0.25;
      if (i < 12) {
        bands[i] = Math.max(0.05, Math.min(1.0, bassWave * 0.8 + localWave * 0.3));
      } else if (i < 36) {
        bands[i] = Math.max(0.05, Math.min(1.0, midWave * 0.7 + localWave * 0.25));
      } else {
        bands[i] = Math.max(0.05, Math.min(1.0, trebleWave * 0.6 + localWave * 0.2));
      }
    }

    const beatPulse = Math.pow(Math.max(0.0, Math.sin(timeSec * 2.6)), 4.0);
    const rms = 0.22 + beatPulse * 0.35;
    const transient = beatPulse > 0.65 ? (beatPulse - 0.65) / 0.35 : 0.0;

    return {
      schemaVersion: 1,
      sessionId: "synthetic",
      sequence: 0,
      capturedAtUs: Date.now() * 1000,
      sampleRateHz: 48000,
      bands,
      rms,
      peak: rms * 1.35,
      bass: bassWave,
      mid: midWave,
      treble: trebleWave,
      transientCounter: 0,
      transientStrength: transient,
      activity: "Active",
      discontinuity: false,
    };
  }
}

