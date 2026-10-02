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

  public updateAnalysisFrame(frame: AnalysisFrame) {
    this.latestAnalysisFrame = frame;
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
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.currentScene.resize(width, height, dpr);
  }

  private loop = (timestamp: number) => {
    const deltaMs = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    const deltaSec = Math.min(deltaMs / 1000, 0.05); // Clamp dt to 50ms per SDD Section 9

    if (this.currentScene && this.gl) {
      this.currentScene.update(deltaSec, this.latestAnalysisFrame);
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
   * Generates a synthetic ambient analysis frame when native audio loopback is idle
   */
  public createSyntheticFrame(timeSec: number): AnalysisFrame {
    const bands = new Array(64);
    for (let i = 0; i < 64; i++) {
      const freqFactor = (64 - i) / 64;
      bands[i] = Math.max(
        0,
        Math.sin(timeSec * 2.5 + i * 0.15) * 0.25 * freqFactor + 0.15
      );
    }

    return {
      schemaVersion: 1,
      sessionId: "synthetic",
      sequence: 0,
      capturedAtUs: Date.now() * 1000,
      sampleRateHz: 48000,
      bands,
      rms: 0.2 + Math.sin(timeSec) * 0.1,
      peak: 0.35,
      bass: 0.3,
      mid: 0.2,
      treble: 0.15,
      transientCounter: 0,
      transientStrength: 0,
      activity: "Active",
      discontinuity: false,
    };
  }
}

