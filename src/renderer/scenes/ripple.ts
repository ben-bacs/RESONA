import { IScene } from "../scene-contract";
import { AnalysisFrame, AppearanceParameters, QualityTier } from "../../types/contracts";
import { createProgram, createQuad, QUAD_VS } from "../gl-utils";
import { resolvePalette } from "../palette-utils";

interface RippleItem {
  x: number;
  y: number;
  age: number;
  amplitude: number;
  maxLife: number;
}

export class RippleScene implements IScene {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;

  // Uniform locations
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uBrightnessLoc: WebGLUniformLocation | null = null;
  private uSensitivityLoc: WebGLUniformLocation | null = null;
  private uRingWidthLoc: WebGLUniformLocation | null = null;
  private uColorALoc: WebGLUniformLocation | null = null;
  private uColorBLoc: WebGLUniformLocation | null = null;
  private uColorCLoc: WebGLUniformLocation | null = null;
  private uRipplesLoc: WebGLUniformLocation | null = null; // vec4 array: x, y, radius, intensity
  private uRippleCountLoc: WebGLUniformLocation | null = null;

  private width = 800;
  private height = 600;
  private time = 0;

  // Fixed capacity pool per SDD Section 9 (max 64 on high, 32 med, 16 low)
  private maxPoolSize = 64;
  private ripples: RippleItem[] = [];
  private lastTransientCounter = 0;
  private spawnCooldown = 0;

  private smoothedRms = 0;
  private smoothedTransient = 0;

  private parameters: AppearanceParameters = {
    brightness: 0.8,
    sensitivity: 1.0,
    motionSpeed: 1.0,
    colorPalette: "oceanic_azure",
    bloomIntensity: 0.3,
    presetSpecific: {
      decaySeconds: 2.0,
      ringWidthPx: 2.0,
    },
  };

  initialize(gl: WebGL2RenderingContext, quality: QualityTier, _seed?: number): boolean {
    this.gl = gl;
    this.maxPoolSize = quality === "low" ? 16 : quality === "medium" ? 32 : 64;
    this.ripples = [];

    const fsSource = `#version 300 es
      precision highp float;
      in vec2 v_uv;
      out vec4 fragColor;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_brightness;
      uniform float u_sensitivity;
      uniform float u_ringWidthPx;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      uniform vec3 u_colorC;

      // Pool of active ripples: xy = center, z = radius, w = intensity
      uniform vec4 u_ripples[64];
      uniform int u_rippleCount;

      #define PI 3.14159265359

      void main() {
        if (u_brightness <= 0.001) {
          fragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
        vec3 finalColor = vec3(0.0);

        float minDim = min(u_resolution.x, u_resolution.y);
        float ringThick = max(u_ringWidthPx / minDim, 0.003);

        int count = clamp(u_rippleCount, 0, 64);
        float totalRipple = 0.0;

        for (int i = 0; i < 64; i++) {
          if (i >= count) break;
          vec4 rip = u_ripples[i];
          vec2 center = rip.xy;
          float radius = rip.z;
          float intensity = rip.w;

          float d = length(uv - center);
          float ringDist = abs(d - radius);

          // Wave pulse falloff
          float wave = smoothstep(ringThick * 2.5, 0.0, ringDist);
          // Echo waves
          float echo = smoothstep(ringThick * 2.0, 0.0, abs(d - radius * 0.75)) * 0.4;

          totalRipple += (wave + echo) * intensity;
        }

        // Color ripples with fluid gradient
        vec3 rippleColor = mix(u_colorA, u_colorB, sin(length(uv) * 4.0 - u_time) * 0.5 + 0.5);
        rippleColor = mix(rippleColor, u_colorC, clamp(totalRipple * 0.5, 0.0, 1.0));

        finalColor = rippleColor * totalRipple * 2.8;

        // Ambient water surface reflections / caustics
        float caustics = sin(uv.x * 12.0 + u_time) * sin(uv.y * 12.0 + u_time * 0.8) * 0.08;
        finalColor += u_colorA * (max(0.0, caustics) * u_brightness * 2.0);

        finalColor *= u_brightness * 1.25;
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
    this.uBrightnessLoc = gl.getUniformLocation(prog, "u_brightness");
    this.uSensitivityLoc = gl.getUniformLocation(prog, "u_sensitivity");
    this.uRingWidthLoc = gl.getUniformLocation(prog, "u_ringWidthPx");
    this.uColorALoc = gl.getUniformLocation(prog, "u_colorA");
    this.uColorBLoc = gl.getUniformLocation(prog, "u_colorB");
    this.uColorCLoc = gl.getUniformLocation(prog, "u_colorC");
    this.uRipplesLoc = gl.getUniformLocation(prog, "u_ripples");
    this.uRippleCountLoc = gl.getUniformLocation(prog, "u_rippleCount");

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

    const decaySeconds = Math.max(0.5, Number(this.parameters.presetSpecific?.decaySeconds ?? 2.0));
    this.spawnCooldown = Math.max(0, this.spawnCooldown - dt);

    const sens = this.parameters.sensitivity;
    const factor = Math.min(1.0, dt * 14.0);

    const targetRms = Math.max(0.12, (analysis?.rms || 0.0) * sens);
    const targetTransient = (analysis?.transientStrength || 0.0) * sens;

    this.smoothedRms += (targetRms - this.smoothedRms) * factor;
    this.smoothedTransient += (targetTransient - this.smoothedTransient) * factor;

    // Check transient onset or high audio peak or ambient rhythm to spawn ripple
    const transientFired =
      analysis &&
      (analysis.transientCounter !== this.lastTransientCounter ||
        (analysis.transientStrength > 0.35 && this.spawnCooldown <= 0) ||
        (this.ripples.length < 3 && Math.random() < 0.04));

    if (analysis) {
      this.lastTransientCounter = analysis.transientCounter;
    }

    if (transientFired && this.spawnCooldown <= 0) {
      this.spawnCooldown = 0.06; // Fast responsive spawn

      // Fixed capacity pool: if full, drop oldest
      if (this.ripples.length >= this.maxPoolSize) {
        this.ripples.shift();
      }

      // Spawn at center with small harmonic jitter based on bands
      const angle = Math.random() * Math.PI * 2.0;
      const radiusOffset = (analysis?.mid || 0.1) * 0.35;
      this.ripples.push({
        x: Math.cos(angle) * radiusOffset,
        y: Math.sin(angle) * radiusOffset,
        age: 0,
        amplitude: 0.6 + Math.min(1.2, (analysis?.transientStrength || 0.4) * 1.2),
        maxLife: decaySeconds,
      });
    }

    // Age ripples and remove expired
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rip = this.ripples[i];
      rip.age += dt * this.parameters.motionSpeed;
      if (rip.age >= rip.maxLife) {
        this.ripples.splice(i, 1);
      }
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

    const ringWidth = Number(this.parameters.presetSpecific?.ringWidthPx ?? 2.0);
    gl.uniform1f(this.uRingWidthLoc, ringWidth);

    const [cA, cB, cC] = resolvePalette(this.parameters.colorPalette);
    gl.uniform3f(this.uColorALoc, cA.r, cA.g, cA.b);
    gl.uniform3f(this.uColorBLoc, cB.r, cB.g, cB.b);
    gl.uniform3f(this.uColorCLoc, cC.r, cC.g, cC.b);

    // Package ripples into uniform array [x, y, radius, intensity]
    const rippleUniforms = new Float32Array(64 * 4);
    const count = Math.min(this.ripples.length, 64);

    for (let i = 0; i < count; i++) {
      const rip = this.ripples[i];
      const lifeFrac = rip.age / rip.maxLife; // 0.0 to 1.0
      const radius = lifeFrac * 1.6; // expands to 1.6 units
      const intensity = rip.amplitude * (1.0 - lifeFrac);

      const offset = i * 4;
      rippleUniforms[offset] = rip.x;
      rippleUniforms[offset + 1] = rip.y;
      rippleUniforms[offset + 2] = radius;
      rippleUniforms[offset + 3] = intensity;
    }

    gl.uniform4fv(this.uRipplesLoc, rippleUniforms);
    gl.uniform1i(this.uRippleCountLoc, count);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    this.ripples = [];
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.program) gl.deleteProgram(this.program);
    this.program = null;
    this.vao = null;
    this.vbo = null;
    this.gl = null;
  }
}
