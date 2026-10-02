import { AnalysisFrame, AppearanceParameters, QualityTier } from "../types/contracts";

export interface IScene {
  /**
   * Allocate bounded GPU resources, shaders, and geometry buffers.
   */
  initialize(gl: WebGL2RenderingContext, quality: QualityTier, seed?: number): boolean;

  /**
   * Handle viewport resize and DPI scaling updates.
   */
  resize(width: number, height: number, devicePixelRatio: number): void;

  /**
   * Apply user-configured visual parameters immediately.
   */
  applyParameters(params: AppearanceParameters): void;

  /**
   * Update internal simulation state given elapsed time and new analysis frame.
   */
  update(deltaSeconds: number, analysis: AnalysisFrame): void;

  /**
   * Execute draw calls to the active WebGL2 target framebuffer.
   */
  render(): void;

  /**
   * Safely and idempotently release all allocated textures, programs, and buffers.
   */
  dispose(): void;
}
