import { IScene } from "../scene-contract";
import { AnalysisFrame, AppearanceParameters, QualityTier } from "../../types/contracts";
import { createProgram, createQuad, QUAD_VS } from "../gl-utils";
import { resolvePalette } from "../palette-utils";

export class AuroraScene implements IScene {
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
  private uCurtainCountLoc: WebGLUniformLocation | null = null;
  private uFlowSpeedLoc: WebGLUniformLocation | null = null;
  private uColorALoc: WebGLUniformLocation | null = null;
  private uColorBLoc: WebGLUniformLocation | null = null;
  private uColorCLoc: WebGLUniformLocation | null = null;

  private width = 800;
  private height = 600;
  private time = 0;
  private quality: QualityTier = "high";

  private smoothedRms = 0;
  private smoothedTransient = 0;
  private smoothedBands = new Float32Array(64);

  private parameters: AppearanceParameters = {
    brightness: 0.75,
    sensitivity: 0.9,
    motionSpeed: 0.8,
    colorPalette: "boreal_glow",
    bloomIntensity: 0.4,
    presetSpecific: {
      curtainCount: 4,
      flowSpeed: 0.1,
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
      uniform int u_curtainCount;
      uniform float u_flowSpeed;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      uniform vec3 u_colorC;

      #define PI 3.14159265359

      // Simple hash noise for procedural curtain folds
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      void main() {
        if (u_brightness <= 0.001) {
          fragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
        vec3 finalColor = vec3(0.0);

        int maxCurtains = clamp(u_curtainCount, 1, 8);

        for (int i = 0; i < 8; i++) {
          if (i >= maxCurtains) break;
          float fi = float(i);

          int bandIndex = int(clamp(fi * 8.0, 0.0, 63.0));
          float bandEnergy = u_bands[bandIndex] * u_sensitivity;

          // Flow speed and phase
          float flowTime = u_time * (u_flowSpeed * 4.0 + 0.2) + fi * 1.8;

          // Ribbon undulating path in sky
          float curveY = 0.15 + fi * 0.12 + 
            sin(uv.x * 1.5 + flowTime) * 0.18 + 
            cos(uv.x * 3.2 - flowTime * 0.6) * 0.09 * (1.0 + bandEnergy * 0.5);

          // Vertical ray folds
          float rayNoise = noise(vec2(uv.x * 8.0 + flowTime * 0.5, fi));
          float flare = (u_rms * 0.5) + (u_transient * 0.4) + (bandEnergy * 0.3);

          // Curtain distance and vertical flare height
          float dy = uv.y - curveY;
          if (dy > -0.1) {
            float curtainHeight = 0.5 + flare * 0.4;
            float verticalAtten = smoothstep(curtainHeight, 0.0, dy);
            float baseAtten = smoothstep(-0.1, 0.0, dy);
            float curtainDensity = verticalAtten * baseAtten * (0.6 + rayNoise * 0.4);

            // Shifting gradient: Emerald Green at bottom -> Mystical Violet/Purple at top
            float heightFrac = clamp(dy / curtainHeight, 0.0, 1.0);
            vec3 curtainColor = mix(u_colorA, u_colorB, heightFrac);
            curtainColor = mix(curtainColor, u_colorC, u_transient * 0.5);

            finalColor += curtainColor * curtainDensity * (0.8 + flare);
          }
        }

        // Night sky ambient stars/glow
        float skyGlow = smoothstep(-1.0, 1.0, uv.y) * 0.05 * u_colorB.g;
        finalColor += u_colorB * skyGlow;

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
    this.uRmsLoc = gl.getUniformLocation(prog, "u_rms");
    this.uTransientLoc = gl.getUniformLocation(prog, "u_transient");
    this.uBrightnessLoc = gl.getUniformLocation(prog, "u_brightness");
    this.uSensitivityLoc = gl.getUniformLocation(prog, "u_sensitivity");
    this.uCurtainCountLoc = gl.getUniformLocation(prog, "u_curtainCount");
    this.uFlowSpeedLoc = gl.getUniformLocation(prog, "u_flowSpeed");
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

    const targetRms = isSilent ? 0.0 : analysis.rms;
    const targetTransient = isSilent ? 0.0 : analysis.transientStrength;

    this.smoothedRms += (targetRms - this.smoothedRms) * factor;
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

    // Quality tier caps for curtainCount: Low: 2, Medium: 4, High: 8
    const maxTierCurtains = this.quality === "low" ? 2 : this.quality === "medium" ? 4 : 8;
    const requestedCurtains = Math.round(Number(this.parameters.presetSpecific?.curtainCount ?? 4));
    const activeCurtains = Math.min(Math.max(1, requestedCurtains), maxTierCurtains);
    gl.uniform1i(this.uCurtainCountLoc, activeCurtains);

    const flowSpeed = Number(this.parameters.presetSpecific?.flowSpeed ?? 0.1);
    gl.uniform1f(this.uFlowSpeedLoc, flowSpeed);

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

