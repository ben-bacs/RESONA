import { IScene } from "../scene-contract";
import { AnalysisFrame, AppearanceParameters, QualityTier } from "../../types/contracts";
import { createProgram, createQuad, QUAD_VS } from "../gl-utils";
import { resolvePalette } from "../palette-utils";

export class NeonHighwayScene implements IScene {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;

  // Uniform locations
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uBandsLoc: WebGLUniformLocation | null = null;
  private uBassLoc: WebGLUniformLocation | null = null;
  private uMidLoc: WebGLUniformLocation | null = null;
  private uTransientLoc: WebGLUniformLocation | null = null;
  private uBrightnessLoc: WebGLUniformLocation | null = null;
  private uSensitivityLoc: WebGLUniformLocation | null = null;
  private uGridLinesLoc: WebGLUniformLocation | null = null;
  private uHorizonGlowLoc: WebGLUniformLocation | null = null;
  private uColorALoc: WebGLUniformLocation | null = null;
  private uColorBLoc: WebGLUniformLocation | null = null;
  private uColorCLoc: WebGLUniformLocation | null = null;

  private width = 800;
  private height = 600;
  private time = 0;
  private quality: QualityTier = "high";

  private smoothedBass = 0;
  private smoothedMid = 0;
  private smoothedTransient = 0;
  private smoothedBands = new Float32Array(64);

  private parameters: AppearanceParameters = {
    brightness: 0.9,
    sensitivity: 1.0,
    motionSpeed: 1.1,
    colorPalette: "synthwave",
    bloomIntensity: 0.8,
    presetSpecific: {
      gridLines: 24,
      horizonGlow: 0.4,
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
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_transient;
      uniform float u_brightness;
      uniform float u_sensitivity;
      uniform int u_gridLines;
      uniform float u_horizonGlow;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      uniform vec3 u_colorC;

      #define PI 3.14159265359

      void main() {
        if (u_brightness <= 0.001) {
          fragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        // Screen coords normalized to [-1, 1]
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
        vec3 finalColor = vec3(0.0);

        float horizonY = -0.05;

        if (uv.y < horizonY) {
          // Perspective floor plane
          float depth = horizonY / (uv.y - horizonY);
          float worldZ = depth * 2.0 + u_time * 2.5;
          float worldX = uv.x * depth * 2.5;

          // Bass terrain undulation along sides
          float sideDist = abs(worldX);
          float terrainAmp = u_bass * 0.4 * smoothstep(1.0, 3.5, sideDist);
          float terrain = sin(worldZ * 1.5 + worldX) * terrainAmp;

          // Grid line density
          float density = float(clamp(u_gridLines, 8, 64)) * 0.15;
          float gridX = fract(worldX * density);
          float gridZ = fract(worldZ * density);

          float lineX = abs(gridX - 0.5);
          float lineZ = abs(gridZ - 0.5);

          // Grid wire thickness
          float wireX = smoothstep(0.46, 0.5, lineX);
          float wireZ = smoothstep(0.46, 0.5, lineZ);
          float gridVal = max(wireX, wireZ);

          // Perspective depth fade
          float fog = clamp(1.0 / (depth * 0.35 + 1.0), 0.0, 1.0);

          // Grid line coloring
          vec3 gridColor = mix(u_colorA, u_colorB, sin(worldZ * 0.2) * 0.5 + 0.5);
          gridColor = mix(gridColor, u_colorC, u_transient * 0.5);

          finalColor = gridColor * gridVal * fog * (1.0 + u_mid * 0.8);

          // Reflective surface glow
          finalColor += u_colorA * (0.05 * fog * (1.0 + terrain));
        } else {
          // Sky / Horizon gradient
          float skyY = (uv.y - horizonY);
          float sunDist = length(vec2(uv.x * 1.2, uv.y - 0.25));

          // Synthwave Sun
          if (sunDist < 0.45) {
            float sunGrad = (uv.y - 0.25 + 0.45) / 0.9;
            vec3 sunColor = mix(u_colorA, u_colorC, sunGrad);

            // Sun horizontal blind stripes
            float stripes = sin((uv.y - 0.25) * 45.0);
            if (stripes > 0.3 && uv.y < 0.25) {
              sunColor *= 0.15;
            }

            finalColor = sunColor * (1.0 + u_transient * 0.6);
          }

          // Sky background ambient
          finalColor += u_colorB * (0.08 * exp(-skyY * 2.0));
        }

        // Horizon glow halo
        float horizonDist = abs(uv.y - horizonY);
        float halo = exp(-horizonDist * 18.0) * (0.3 + u_horizonGlow * 1.2 + u_transient * 0.5);
        finalColor += u_colorB * halo;

        finalColor *= u_brightness;
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
    this.uBassLoc = gl.getUniformLocation(prog, "u_bass");
    this.uMidLoc = gl.getUniformLocation(prog, "u_mid");
    this.uTransientLoc = gl.getUniformLocation(prog, "u_transient");
    this.uBrightnessLoc = gl.getUniformLocation(prog, "u_brightness");
    this.uSensitivityLoc = gl.getUniformLocation(prog, "u_sensitivity");
    this.uGridLinesLoc = gl.getUniformLocation(prog, "u_gridLines");
    this.uHorizonGlowLoc = gl.getUniformLocation(prog, "u_horizonGlow");
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

    const isSilent = !analysis || analysis.activity === "Silent";
    const factor = Math.min(1.0, dt * (isSilent ? 4.0 : 12.0));

    const targetBass = isSilent ? 0.0 : analysis.bass * this.parameters.sensitivity;
    const targetMid = isSilent ? 0.0 : analysis.mid * this.parameters.sensitivity;
    const targetTransient = isSilent ? 0.0 : analysis.transientStrength;

    this.smoothedBass += (targetBass - this.smoothedBass) * factor;
    this.smoothedMid += (targetMid - this.smoothedMid) * factor;
    this.smoothedTransient += (targetTransient - this.smoothedTransient) * factor;

    for (let i = 0; i < 64; i++) {
      const targetBand = isSilent ? 0.0 : (analysis.bands[i] || 0.0);
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

    // Quality tier caps for grid lines: Low: 24, Medium: 48, High: 64
    const maxTierLines = this.quality === "low" ? 24 : this.quality === "medium" ? 48 : 64;
    const requestedLines = Math.round(Number(this.parameters.presetSpecific?.gridLines ?? 24));
    const activeLines = Math.min(Math.max(8, requestedLines), maxTierLines);
    gl.uniform1i(this.uGridLinesLoc, activeLines);

    const horizonGlow = Number(this.parameters.presetSpecific?.horizonGlow ?? 0.4);
    gl.uniform1f(this.uHorizonGlowLoc, horizonGlow);

    const [cA, cB, cC] = resolvePalette(this.parameters.colorPalette);
    gl.uniform3f(this.uColorALoc, cA.r, cA.g, cA.b);
    gl.uniform3f(this.uColorBLoc, cB.r, cB.g, cB.b);
    gl.uniform3f(this.uColorCLoc, cC.r, cC.g, cC.b);

    gl.uniform1fv(this.uBandsLoc, this.smoothedBands);
    gl.uniform1f(this.uBassLoc, this.smoothedBass);
    gl.uniform1f(this.uMidLoc, this.smoothedMid);
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

