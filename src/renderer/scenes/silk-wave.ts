import { IScene } from "../scene-contract";
import { AnalysisFrame, AppearanceParameters, QualityTier } from "../../types/contracts";
import { createProgram, createQuad, QUAD_VS } from "../gl-utils";
import { resolvePalette } from "../palette-utils";

export class SilkWaveScene implements IScene {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;

  // Uniform locations
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uBandsLoc: WebGLUniformLocation | null = null;
  private uRmsLoc: WebGLUniformLocation | null = null;
  private uTransientLoc: WebGLUniformLocation | null = null;
  private uBrightnessLoc: WebGLUniformLocation | null = null;
  private uSensitivityLoc: WebGLUniformLocation | null = null;
  private uLayersLoc: WebGLUniformLocation | null = null;
  private uLineWidthLoc: WebGLUniformLocation | null = null;
  private uColorALoc: WebGLUniformLocation | null = null;
  private uColorBLoc: WebGLUniformLocation | null = null;
  private uColorCLoc: WebGLUniformLocation | null = null;

  private width = 800;
  private height = 600;
  private time = 0;
  private quality: QualityTier = "high";

  // Smoothed audio
  private smoothedRms = 0;
  private smoothedTransient = 0;
  private smoothedBands = new Float32Array(64);

  private parameters: AppearanceParameters = {
    brightness: 0.8,
    sensitivity: 1.0,
    motionSpeed: 0.9,
    colorPalette: "oceanic_azure",
    bloomIntensity: 0.5,
    presetSpecific: {
      layers: 3,
      lineWidthPx: 2,
    },
  };

  initialize(gl: WebGL2RenderingContext, quality: QualityTier, _seed?: number): boolean {
    this.gl = gl;
    this.quality = quality;

    const fsSource = `#version 300 es
      precision highp float;
      in vec2 v_uv;
      out vec4 fragColor;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_bands[64];
      uniform float u_rms;
      uniform float u_transient;
      uniform float u_brightness;
      uniform float u_sensitivity;
      uniform int u_layers;
      uniform float u_lineWidthPx;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      uniform vec3 u_colorC;

      #define PI 3.14159265359

      void main() {
        if (u_brightness <= 0.001) {
          fragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
        vec3 finalColor = vec3(0.0);

        int maxLayers = clamp(u_layers, 1, 8);
        float lineThick = max(u_lineWidthPx / min(u_resolution.x, u_resolution.y), 0.003);

        for (int i = 0; i < 8; i++) {
          if (i >= maxLayers) break;
          float fi = float(i);
          float layerFrac = fi / float(maxLayers);

          // Sample appropriate spectral band segment for this ribbon layer
          int bandIdx = int(clamp(layerFrac * 60.0, 0.0, 63.0));
          float bandEnergy = u_bands[bandIdx] * u_sensitivity;

          // Ribbon vertical baseline
          float baseY = (layerFrac - 0.5) * 0.8;

          // Flowing multi-harmonic wave
          float freq1 = 2.0 + fi * 0.7;
          float freq2 = 4.5 + fi * 1.1;
          float phase = u_time * (1.2 + fi * 0.25) + fi * 1.57;

          float amp = 0.16 + (bandEnergy * 0.38) + (u_rms * 0.30) + (u_transient * 0.22);
          float waveY = baseY + 
            sin(uv.x * freq1 + phase) * amp + 
            cos(uv.x * freq2 - phase * 0.7) * (amp * 0.50);

          // Distance to ribbon line
          float dist = abs(uv.y - waveY);
          float glow = lineThick / max(dist, 0.0008);

          // Layer color interpolation
          vec3 layerCol = mix(u_colorA, u_colorB, layerFrac);
          if (i % 2 == 1) {
            layerCol = mix(layerCol, u_colorC, 0.6);
          }

          // Shading and intensity falloff
          float intensity = glow * (1.0 + bandEnergy * 1.4 + u_transient * 1.5);
          finalColor += layerCol * intensity * (1.0 / float(maxLayers + 1));
        }

        // Bloom and brightness
        finalColor *= u_brightness * 1.6;

        // Subtle atmospheric background gradient
        finalColor += u_colorA * (0.03 * u_brightness * (1.0 - abs(uv.y)));

        finalColor = clamp(finalColor, 0.0, 1.0);
        fragColor = vec4(finalColor, 1.0);
      }
    `;

    const prog = createProgram(gl, QUAD_VS, fsSource);
    if (!prog) return false;
    this.program = prog;

    const quad = createQuad(gl, prog);
    if (!quad) return false;
    this.vao = quad.vao;
    this.vbo = quad.vbo;

    this.uResolutionLoc = gl.getUniformLocation(prog, "u_resolution");
    this.uTimeLoc = gl.getUniformLocation(prog, "u_time");
    this.uBandsLoc = gl.getUniformLocation(prog, "u_bands");
    this.uRmsLoc = gl.getUniformLocation(prog, "u_rms");
    this.uTransientLoc = gl.getUniformLocation(prog, "u_transient");
    this.uBrightnessLoc = gl.getUniformLocation(prog, "u_brightness");
    this.uSensitivityLoc = gl.getUniformLocation(prog, "u_sensitivity");
    this.uLayersLoc = gl.getUniformLocation(prog, "u_layers");
    this.uLineWidthLoc = gl.getUniformLocation(prog, "u_lineWidthPx");
    this.uColorALoc = gl.getUniformLocation(prog, "u_colorA");
    this.uColorBLoc = gl.getUniformLocation(prog, "u_colorB");
    this.uColorCLoc = gl.getUniformLocation(prog, "u_colorC");

    return true;
  }

  resize(width: number, height: number, devicePixelRatio: number): void {
    this.width = width * devicePixelRatio;
    this.height = height * devicePixelRatio;
    if (this.gl) {
      this.gl.viewport(0, 0, this.width, this.height);
    }
  }

  applyParameters(params: AppearanceParameters): void {
    this.parameters = { ...params };
  }

  update(deltaSeconds: number, analysis: AnalysisFrame): void {
    const dt = Math.min(deltaSeconds, 0.05);
    this.time += dt * this.parameters.motionSpeed;

    const sens = this.parameters.sensitivity;
    const factor = Math.min(1.0, dt * 14.0);

    const targetRms = Math.max(0.12, (analysis?.rms || 0.0) * sens);
    const targetTransient = (analysis?.transientStrength || 0.0) * sens;

    this.smoothedRms += (targetRms - this.smoothedRms) * factor;
    this.smoothedTransient += (targetTransient - this.smoothedTransient) * factor;

    for (let i = 0; i < 64; i++) {
      const rawBand = analysis?.bands?.[i] || 0.0;
      const targetBand = rawBand * sens;
      this.smoothedBands[i] += (targetBand - this.smoothedBands[i]) * factor;
    }
  }

  render(): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao) return;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniform2f(this.uResolutionLoc, this.width, this.height);
    gl.uniform1f(this.uTimeLoc, this.time);
    gl.uniform1f(this.uBrightnessLoc, this.parameters.brightness);
    gl.uniform1f(this.uSensitivityLoc, this.parameters.sensitivity);

    // Quality tier layer capping: Low: 2, Medium: 4, High: 8
    const maxTierLayers = this.quality === "low" ? 2 : this.quality === "medium" ? 4 : 8;
    const requestedLayers = Math.round(Number(this.parameters.presetSpecific?.layers ?? 3));
    const activeLayers = Math.min(Math.max(1, requestedLayers), maxTierLayers);
    gl.uniform1i(this.uLayersLoc, activeLayers);

    const lineWidth = Number(this.parameters.presetSpecific?.lineWidthPx ?? 2.0);
    gl.uniform1f(this.uLineWidthLoc, lineWidth);

    const [cA, cB, cC] = resolvePalette(this.parameters.colorPalette);
    gl.uniform3f(this.uColorALoc, cA.r, cA.g, cA.b);
    gl.uniform3f(this.uColorBLoc, cB.r, cB.g, cB.b);
    gl.uniform3f(this.uColorCLoc, cC.r, cC.g, cC.b);

    gl.uniform1fv(this.uBandsLoc, this.smoothedBands);
    gl.uniform1f(this.uRmsLoc, this.smoothedRms);
    gl.uniform1f(this.uTransientLoc, this.smoothedTransient);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.program) gl.deleteProgram(this.program);
    this.program = null;
    this.vao = null;
    this.vbo = null;
    this.gl = null;
  }
}

