import { IScene } from "../scene-contract";
import { AnalysisFrame, AppearanceParameters, QualityTier } from "../../types/contracts";
import { createProgram, createQuad, QUAD_VS } from "../gl-utils";
import { resolvePalette } from "../palette-utils";

export class PulseRingScene implements IScene {
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
  private uRingWidthLoc: WebGLUniformLocation | null = null;
  private uGlowLoc: WebGLUniformLocation | null = null;
  private uColorALoc: WebGLUniformLocation | null = null;
  private uColorBLoc: WebGLUniformLocation | null = null;
  private uColorCLoc: WebGLUniformLocation | null = null;

  private width = 800;
  private height = 600;
  private time = 0;

  // Smoothed audio values
  private smoothedRms = 0.15;
  private smoothedTransient = 0;
  private smoothedBands = new Float32Array(64);

  private parameters: AppearanceParameters = {
    brightness: 0.85,
    sensitivity: 1.0,
    motionSpeed: 1.0,
    colorPalette: "neon_violet",
    bloomIntensity: 0.6,
    presetSpecific: {
      ringWidthPx: 3,
      glow: 0.35,
    },
  };

  initialize(gl: WebGL2RenderingContext, _quality: QualityTier, _seed?: number): boolean {
    this.gl = gl;

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
      uniform float u_ringWidthPx;
      uniform float u_glow;
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
        float dist = length(uv);
        float angle = atan(uv.y, uv.x);
        if (angle < 0.0) angle += 2.0 * PI;

        // Sample symmetric angle for 64 logarithmic bands
        float normAngle = abs(angle / PI - 1.0);
        int bandIdx = int(clamp(normAngle * 63.0, 0.0, 63.0));
        float bandVal = u_bands[bandIdx] * u_sensitivity;

        int bassIdx = int(clamp(normAngle * 12.0, 0.0, 12.0));
        float bassVal = u_bands[bassIdx] * u_sensitivity;

        int trebleIdx = int(clamp(32.0 + normAngle * 31.0, 32.0, 63.0));
        float trebleVal = u_bands[trebleIdx] * u_sensitivity;

        // High-energy beat pulse dynamics
        float beatPulse = u_rms * 0.45 + u_transient * 0.40 + bassVal * 0.25;

        // Multi-frequency Fourier wave deformation
        float wave1 = sin(angle * 8.0 + u_time * 2.5) * (0.035 + bandVal * 0.20);
        float wave2 = cos(angle * 16.0 - u_time * 3.8) * (0.020 + trebleVal * 0.14);
        float wave3 = sin(angle * 32.0 + u_time * 5.2) * (0.010 + trebleVal * 0.08);
        float totalWave = wave1 + wave2 + wave3;

        // 1. Primary main reactive ring
        float mainRadius = 0.42 + beatPulse * 0.22 + totalWave;

        // 2. Inner pulsating sub-bass iris
        float innerRadius = 0.22 + (bassVal * 0.16 + u_rms * 0.12) + sin(angle * 6.0 - u_time * 2.0) * (0.02 + bassVal * 0.07);
        float dInner = abs(dist - innerRadius);

        // 3. Outer shimmering treble halo
        float outerRadius = 0.62 + (u_transient * 0.14 + trebleVal * 0.12) + cos(angle * 24.0 + u_time * 4.0) * (0.015 + trebleVal * 0.09);
        float dOuter = abs(dist - outerRadius);

        // Dynamic thickness & glow in NDC
        float minDim = min(u_resolution.x, u_resolution.y);
        float baseThick = max(u_ringWidthPx / minDim, 0.0035);
        float glowExp = 0.25 + u_glow * 1.8;

        // Chromatic dispersion on beat hits
        float chromaShift = u_transient * 0.022 + u_rms * 0.012;
        float dMainR = abs(dist - (mainRadius + chromaShift));
        float dMainG = abs(dist - mainRadius);
        float dMainB = abs(dist - (mainRadius - chromaShift));

        float glowR = (baseThick / max(dMainR, 0.0009)) * glowExp;
        float glowG = (baseThick / max(dMainG, 0.0009)) * glowExp;
        float glowB = (baseThick / max(dMainB, 0.0009)) * glowExp;
        vec3 mainGlowCol = vec3(glowR, glowG, glowB);

        // Secondary ring glows
        float innerGlow = (baseThick * 0.85 / max(dInner, 0.0011)) * glowExp * 0.75;
        float outerGlow = (baseThick * 0.65 / max(dOuter, 0.0014)) * glowExp * 0.60;

        // Dynamic iridescent palette blend
        vec3 colGrad = mix(u_colorA, u_colorB, sin(angle * 2.0 + u_time * 1.2) * 0.5 + 0.5);
        colGrad = mix(colGrad, u_colorC, clamp(u_transient * 1.2 + bandVal * 0.5, 0.0, 1.0));

        vec3 innerCol = mix(u_colorB, u_colorC, sin(u_time * 2.2) * 0.5 + 0.5);
        vec3 outerCol = mix(u_colorC, u_colorA, cos(angle * 4.0 + u_time) * 0.5 + 0.5);

        vec3 finalColor = mainGlowCol * colGrad;
        finalColor += innerGlow * innerCol;
        finalColor += outerGlow * outerCol;

        // Central resonant energy core
        float coreAura = exp(-dist * 3.8) * (0.22 + beatPulse * 0.55);
        finalColor += mix(u_colorA, u_colorB, 0.5) * coreAura;

        // Radial light beams emanating on beat transient peaks
        float rays = pow(max(0.0, sin(angle * 12.0 + u_time * 1.5)), 8.0) * u_transient * 0.55;
        finalColor += u_colorC * rays * exp(-dist * 1.8);

        // Tone map & master brightness
        finalColor *= u_brightness * 1.4;
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

    // Uniform locations
    this.uResolutionLoc = gl.getUniformLocation(prog, "u_resolution");
    this.uTimeLoc = gl.getUniformLocation(prog, "u_time");
    this.uBandsLoc = gl.getUniformLocation(prog, "u_bands");
    this.uRmsLoc = gl.getUniformLocation(prog, "u_rms");
    this.uTransientLoc = gl.getUniformLocation(prog, "u_transient");
    this.uBrightnessLoc = gl.getUniformLocation(prog, "u_brightness");
    this.uSensitivityLoc = gl.getUniformLocation(prog, "u_sensitivity");
    this.uRingWidthLoc = gl.getUniformLocation(prog, "u_ringWidthPx");
    this.uGlowLoc = gl.getUniformLocation(prog, "u_glow");
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
    const targetTransient = Math.max(0.0, (analysis?.transientStrength || 0.0) * sens);

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

    // Scene specific parameters
    const ringWidth = Number(this.parameters.presetSpecific?.ringWidthPx ?? 3.0);
    const glow = Number(this.parameters.presetSpecific?.glow ?? 0.35);
    gl.uniform1f(this.uRingWidthLoc, ringWidth);
    gl.uniform1f(this.uGlowLoc, glow);

    // Palette
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
