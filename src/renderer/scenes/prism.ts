import { IScene } from "../scene-contract";
import { AnalysisFrame, AppearanceParameters, QualityTier } from "../../types/contracts";
import { createProgram, createQuad, QUAD_VS } from "../gl-utils";
import { resolvePalette } from "../palette-utils";

export class PrismScene implements IScene {
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
  private uSymmetryLoc: WebGLUniformLocation | null = null;
  private uRotationLoc: WebGLUniformLocation | null = null;
  private uColorALoc: WebGLUniformLocation | null = null;
  private uColorBLoc: WebGLUniformLocation | null = null;
  private uColorCLoc: WebGLUniformLocation | null = null;

  private width = 800;
  private height = 600;
  private currentAngle = 0;
  private time = 0;

  private smoothedRms = 0;
  private smoothedTransient = 0;
  private smoothedBands = new Float32Array(64);

  private parameters: AppearanceParameters = {
    brightness: 0.85,
    sensitivity: 1.0,
    motionSpeed: 1.0,
    colorPalette: "chromatic_prism",
    bloomIntensity: 0.7,
    presetSpecific: {
      symmetry: 6,
      rotationDegPerSec: 6.0,
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
      uniform float u_symmetry;
      uniform float u_currentAngle;
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
        float r = length(uv);
        float a = atan(uv.y, uv.x) + u_currentAngle;

        // Fold coordinate space into N symmetry sectors
        float sectors = max(2.0, u_symmetry);
        float sectorAngle = (2.0 * PI) / sectors;
        a = mod(a, sectorAngle) - 0.5 * sectorAngle;
        a = abs(a); // Mirror symmetry inside sector

        // Reconstruct folded UV coordinates with audio breathing expansion
        float audioExpand = 1.0 - clamp(u_rms * 0.22 + u_transient * 0.12, 0.0, 0.35);
        vec2 foldedUv = vec2(cos(a), sin(a)) * (r * audioExpand);

        // Sample spectrum based on radial coordinate
        int bandIdx = int(clamp(r * 40.0, 0.0, 63.0));
        float bandEnergy = u_bands[bandIdx] * u_sensitivity;
        float subBass = u_bands[2] * u_sensitivity;

        // Crystalline facet geometry with multi-layered lattice
        float facet1 = abs(foldedUv.x - 0.35 - (u_rms * 0.18));
        float facet2 = abs(foldedUv.y - foldedUv.x * 0.577 - (bandEnergy * 0.14));
        float facet3 = abs(r - (0.45 + subBass * 0.22) - (u_transient * 0.14));
        float facet4 = abs(foldedUv.x + foldedUv.y * 0.7 - 0.58);

        float line1 = smoothstep(0.024 + u_transient * 0.02, 0.0, facet1);
        float line2 = smoothstep(0.024 + bandEnergy * 0.02, 0.0, facet2);
        float line3 = smoothstep(0.032 + u_transient * 0.025, 0.0, facet3);
        float line4 = smoothstep(0.018, 0.0, facet4) * 0.6;

        float pattern = max(max(line1, line2), max(line3, line4));

        // Prism refraction color shifting & iridescent chromatic dispersion
        float dispersion = sin(r * 10.0 - u_time * 2.0 + u_transient * 2.8) * 0.5 + 0.5;
        vec3 prismCol = mix(u_colorA, u_colorB, dispersion);
        prismCol = mix(prismCol, u_colorC, pattern * 0.75 + u_transient * 0.35);

        // Radiant jewel rays radiating through crystal facets on beats
        float rayAngle = atan(uv.y, uv.x) * sectors + u_time * 0.7;
        float rays = pow(max(0.0, cos(rayAngle)), 6.0) * (0.25 + u_transient * 1.3 + u_rms * 0.5);

        // Core jewel glow & ambient luminous floor
        float centerGlow = 0.085 / (r + 0.07) * (0.85 + u_rms * 1.6 + u_transient * 2.0);
        vec3 finalColor = (prismCol * (pattern * 1.8 + rays * 1.0) + mix(u_colorB, u_colorC, 0.5) * centerGlow) * u_brightness;

        // Soft chromatic ring flare on beat hits
        float beatRing = smoothstep(0.04, 0.0, abs(r - (0.35 + u_transient * 0.45))) * u_transient * 0.85;
        finalColor += u_colorA * beatRing * u_brightness;

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
    this.uSymmetryLoc = gl.getUniformLocation(prog, "u_symmetry");
    this.uRotationLoc = gl.getUniformLocation(prog, "u_currentAngle");
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
    const rawRms = analysis ? analysis.rms * sens : 0.0;
    const rawTransient = analysis ? analysis.transientStrength * sens : 0.0;

    const targetRms = Math.max(0.12, rawRms);
    const targetTransient = rawTransient;

    const factor = Math.min(1.0, dt * 14.0);
    this.smoothedRms += (targetRms - this.smoothedRms) * factor;
    this.smoothedTransient += (targetTransient - this.smoothedTransient) * factor;

    // Reduced motion clamps rotation to 0; otherwise rotation speeds up dynamically on beats
    const rotSpeedDeg = Number(this.parameters.presetSpecific?.rotationDegPerSec ?? 6.0);
    const radPerSec = (rotSpeedDeg * Math.PI) / 180.0;
    const audioAccel = 1.0 + this.smoothedRms * 1.6 + this.smoothedTransient * 2.2;
    this.currentAngle += radPerSec * dt * this.parameters.motionSpeed * audioAccel;

    for (let i = 0; i < 64; i++) {
      const rawBand = analysis ? (analysis.bands[i] || 0.0) * sens : 0.0;
      const targetBand = Math.max(0.08, rawBand);
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

    const symmetry = Math.round(Number(this.parameters.presetSpecific?.symmetry ?? 6.0));
    gl.uniform1f(this.uSymmetryLoc, Math.min(16, Math.max(2, symmetry)));
    gl.uniform1f(this.uRotationLoc, this.currentAngle);

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

