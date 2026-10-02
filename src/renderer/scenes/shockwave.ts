import { IScene } from "../scene-contract";
import { AnalysisFrame, AppearanceParameters, QualityTier } from "../../types/contracts";
import { compileShader, createProgram, createQuad, QUAD_VS } from "../gl-utils";
import { resolvePalette } from "../palette-utils";

interface ShockwaveRing {
  age: number;
  maxLife: number;
  amplitude: number;
}

export class ShockwaveScene implements IScene {
  private gl: WebGL2RenderingContext | null = null;
  private quadProgram: WebGLProgram | null = null;
  private particleProgram: WebGLProgram | null = null;

  private quadVao: WebGLVertexArrayObject | null = null;
  private quadVbo: WebGLBuffer | null = null;

  private particleVao: WebGLVertexArrayObject | null = null;
  private particleVbo: WebGLBuffer | null = null;

  // Quad Uniforms (shockwave ring)
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uBrightnessLoc: WebGLUniformLocation | null = null;
  private uRingRadiusLoc: WebGLUniformLocation | null = null;
  private uRingIntensityLoc: WebGLUniformLocation | null = null;
  private uColorALoc: WebGLUniformLocation | null = null;
  private uColorBLoc: WebGLUniformLocation | null = null;
  private uColorCLoc: WebGLUniformLocation | null = null;

  // Particle Uniforms
  private uParticleResLoc: WebGLUniformLocation | null = null;
  private uParticleBrightLoc: WebGLUniformLocation | null = null;
  private uParticleColALoc: WebGLUniformLocation | null = null;
  private uParticleColBLoc: WebGLUniformLocation | null = null;

  private width = 800;
  private height = 600;

  // Particle pool (SDD Section 9: Low: 256, Medium: 1024, High: 2048)
  private maxPoolCapacity = 2048;
  // 4 floats per particle: x, y, life (0..1), seed
  private particleBuffer = new Float32Array(2048 * 4);
  // Velocity arrays
  private vx = new Float32Array(2048);
  private vy = new Float32Array(2048);
  private life = new Float32Array(2048);
  private maxLife = new Float32Array(2048);
  private seed = new Float32Array(2048);
  private activeParticles = 0;
  private nextParticleIndex = 0;

  // Active ring
  private currentRing: ShockwaveRing = { age: 10, maxLife: 1, amplitude: 0 };
  private lastTransientCounter = 0;
  private spawnCooldown = 0;

  private smoothedRms = 0;
  private smoothedTransient = 0;

  private parameters: AppearanceParameters = {
    brightness: 0.95,
    sensitivity: 1.2,
    motionSpeed: 1.3,
    colorPalette: "solar_flare",
    bloomIntensity: 0.85,
    presetSpecific: {
      burstParticles: 64,
      decaySeconds: 0.8,
    },
  };

  initialize(gl: WebGL2RenderingContext, quality: QualityTier, _seed?: number): boolean {
    this.gl = gl;

    this.maxPoolCapacity = quality === "low" ? 256 : quality === "medium" ? 1024 : 2048;
    this.particleBuffer = new Float32Array(this.maxPoolCapacity * 4);
    this.vx = new Float32Array(this.maxPoolCapacity);
    this.vy = new Float32Array(this.maxPoolCapacity);
    this.life = new Float32Array(this.maxPoolCapacity);
    this.maxLife = new Float32Array(this.maxPoolCapacity);
    this.seed = new Float32Array(this.maxPoolCapacity);
    this.activeParticles = 0;
    this.nextParticleIndex = 0;

    // 1. Quad Program for background aura and expanding shockwave ring
    const quadFs = `#version 300 es
      precision highp float;
      in vec2 v_uv;
      out vec4 fragColor;

      uniform vec2 u_resolution;
      uniform float u_brightness;
      uniform float u_ringRadius;
      uniform float u_ringIntensity;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      uniform vec3 u_colorC;

      void main() {
        if (u_brightness <= 0.001) {
          fragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
        float d = length(uv);

        // Expanding shockwave distortion ring
        float ringDist = abs(d - u_ringRadius);
        float ring = smoothstep(0.05, 0.0, ringDist) * u_ringIntensity;

        // Core glow
        float core = smoothstep(0.4, 0.0, d) * (0.15 + u_ringIntensity * 0.3);

        vec3 ringColor = mix(u_colorA, u_colorB, d * 0.8);
        ringColor = mix(ringColor, u_colorC, ring);

        vec3 col = (ringColor * ring * 2.0 + u_colorA * core) * u_brightness;
        fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `;

    const qProg = createProgram(gl, QUAD_VS, quadFs);
    if (!qProg) return false;
    this.quadProgram = qProg;

    const quad = createQuad(gl, qProg);
    if (!quad) return false;
    this.quadVao = quad.vao;
    this.quadVbo = quad.vbo;

    this.uResolutionLoc = gl.getUniformLocation(qProg, "u_resolution");
    this.uBrightnessLoc = gl.getUniformLocation(qProg, "u_brightness");
    this.uRingRadiusLoc = gl.getUniformLocation(qProg, "u_ringRadius");
    this.uRingIntensityLoc = gl.getUniformLocation(qProg, "u_ringIntensity");
    this.uColorALoc = gl.getUniformLocation(qProg, "u_colorA");
    this.uColorBLoc = gl.getUniformLocation(qProg, "u_colorB");
    this.uColorCLoc = gl.getUniformLocation(qProg, "u_colorC");

    // 2. Particle Program for burst sparks
    const partVs = `#version 300 es
      in vec4 a_particle; // x, y, lifeRemainingFrac, seed
      out float v_life;
      out float v_seed;

      uniform vec2 u_resolution;

      void main() {
        v_life = a_particle.z;
        v_seed = a_particle.w;

        float aspect = u_resolution.x / u_resolution.y;
        vec2 pos = a_particle.xy;
        pos.x /= aspect;

        gl_Position = vec4(pos, 0.0, 1.0);
        gl_PointSize = clamp(v_life * 14.0 * (0.8 + v_seed * 0.6), 1.5, 24.0);
      }
    `;

    const partFs = `#version 300 es
      precision highp float;
      in float v_life;
      in float v_seed;
      out vec4 fragColor;

      uniform float u_brightness;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;

      void main() {
        if (u_brightness <= 0.001) {
          fragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        vec2 coord = gl_PointCoord - vec2(0.5);
        float d = length(coord);
        if (d > 0.5) discard;

        float alpha = smoothstep(0.5, 0.05, d) * v_life;
        vec3 col = mix(u_colorA, u_colorB, v_seed) * alpha * u_brightness * 1.5;

        fragColor = vec4(col, 1.0);
      }
    `;

    const pVs = compileShader(gl, gl.VERTEX_SHADER, partVs);
    const pFs = compileShader(gl, gl.FRAGMENT_SHADER, partFs);
    if (!pVs || !pFs) return false;

    const pProg = gl.createProgram();
    if (!pProg) return false;
    gl.attachShader(pProg, pVs);
    gl.attachShader(pProg, pFs);
    gl.linkProgram(pProg);
    gl.deleteShader(pVs);
    gl.deleteShader(pFs);

    if (!gl.getProgramParameter(pProg, gl.LINK_STATUS)) {
      console.error("Shockwave particle program error:", gl.getProgramInfoLog(pProg));
      return false;
    }
    this.particleProgram = pProg;

    this.particleVao = gl.createVertexArray();
    this.particleVbo = gl.createBuffer();
    gl.bindVertexArray(this.particleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.particleBuffer, gl.DYNAMIC_DRAW);

    const aPartLoc = gl.getAttribLocation(pProg, "a_particle");
    if (aPartLoc >= 0) {
      gl.enableVertexAttribArray(aPartLoc);
      gl.vertexAttribPointer(aPartLoc, 4, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0);
    }
    gl.bindVertexArray(null);

    this.uParticleResLoc = gl.getUniformLocation(pProg, "u_resolution");
    this.uParticleBrightLoc = gl.getUniformLocation(pProg, "u_brightness");
    this.uParticleColALoc = gl.getUniformLocation(pProg, "u_colorA");
    this.uParticleColBLoc = gl.getUniformLocation(pProg, "u_colorB");

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

  private triggerBurst(decaySeconds: number, particleCount: number, intensity: number) {
    this.currentRing = {
      age: 0,
      maxLife: decaySeconds,
      amplitude: intensity,
    };

    const count = Math.min(particleCount, this.maxPoolCapacity);
    for (let i = 0; i < count; i++) {
      const idx = this.nextParticleIndex;
      this.nextParticleIndex = (this.nextParticleIndex + 1) % this.maxPoolCapacity;
      if (this.activeParticles < this.maxPoolCapacity) {
        this.activeParticles++;
      }

      const angle = Math.random() * Math.PI * 2.0;
      const speed = 0.5 + Math.random() * 1.5 * intensity;

      this.vx[idx] = Math.cos(angle) * speed;
      this.vy[idx] = Math.sin(angle) * speed;
      this.life[idx] = 0;
      this.maxLife[idx] = decaySeconds * (0.6 + Math.random() * 0.8);
      this.seed[idx] = Math.random();

      const bIdx = idx * 4;
      this.particleBuffer[bIdx] = 0;
      this.particleBuffer[bIdx + 1] = 0;
      this.particleBuffer[bIdx + 2] = 1.0;
      this.particleBuffer[bIdx + 3] = this.seed[idx];
    }
  }

  update(deltaSeconds: number, analysis: AnalysisFrame): void {
    const dt = Math.min(deltaSeconds, 0.05);

    const isSilent = !analysis || analysis.activity === "Silent";
    const factor = Math.min(1.0, dt * (isSilent ? 4.0 : 12.0));

    const targetRms = isSilent ? 0.0 : analysis.rms * this.parameters.sensitivity;
    const targetTransient = isSilent ? 0.0 : analysis.transientStrength;

    this.smoothedRms += (targetRms - this.smoothedRms) * factor;
    this.smoothedTransient += (targetTransient - this.smoothedTransient) * factor;

    const decaySeconds = Math.max(0.2, Number(this.parameters.presetSpecific?.decaySeconds ?? 0.8));
    const burstParticles = Math.round(Number(this.parameters.presetSpecific?.burstParticles ?? 64));

    this.spawnCooldown = Math.max(0, this.spawnCooldown - dt);

    const transientFired =
      analysis &&
      (analysis.transientCounter !== this.lastTransientCounter ||
        (analysis.transientStrength > 0.45 && this.spawnCooldown <= 0));

    if (analysis) {
      this.lastTransientCounter = analysis.transientCounter;
    }

    if (transientFired && this.spawnCooldown <= 0) {
      this.spawnCooldown = 0.1;
      const intensity = 0.6 + Math.min(1.0, (analysis?.transientStrength || 0.5) * 0.9);
      this.triggerBurst(decaySeconds, burstParticles, intensity);
    }

    // Update ring
    this.currentRing.age += dt * this.parameters.motionSpeed;

    // Update particles
    const drag = Math.exp(-2.5 * dt);
    for (let i = 0; i < this.activeParticles; i++) {
      if (this.life[i] >= this.maxLife[i]) continue;

      this.life[i] += dt * this.parameters.motionSpeed;
      const lifeFrac = Math.max(0.0, 1.0 - this.life[i] / this.maxLife[i]);

      this.vx[i] *= drag;
      this.vy[i] *= drag;

      const bIdx = i * 4;
      this.particleBuffer[bIdx] += this.vx[i] * dt * this.parameters.motionSpeed;
      this.particleBuffer[bIdx + 1] += this.vy[i] * dt * this.parameters.motionSpeed;
      this.particleBuffer[bIdx + 2] = lifeFrac;
    }

    if (this.gl && this.particleVbo && this.activeParticles > 0) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.particleVbo);
      this.gl.bufferSubData(
        this.gl.ARRAY_BUFFER,
        0,
        this.particleBuffer.subarray(0, this.activeParticles * 4)
      );
    }
  }

  render(): void {
    const gl = this.gl;
    if (!gl || !this.quadProgram || !this.particleProgram || !this.quadVao || !this.particleVao) return;

    const [cA, cB, cC] = resolvePalette(this.parameters.colorPalette);

    // 1. Draw shockwave distortion ring
    gl.useProgram(this.quadProgram);
    gl.bindVertexArray(this.quadVao);

    gl.uniform2f(this.uResolutionLoc, this.width, this.height);
    gl.uniform1f(this.uBrightnessLoc, this.parameters.brightness);

    const ringProgress = this.currentRing.age / Math.max(0.01, this.currentRing.maxLife);
    const ringRadius = ringProgress * 1.8;
    const ringIntensity = this.currentRing.amplitude * Math.max(0.0, 1.0 - ringProgress);

    gl.uniform1f(this.uRingRadiusLoc, ringRadius);
    gl.uniform1f(this.uRingIntensityLoc, ringIntensity);
    gl.uniform3f(this.uColorALoc, cA.r, cA.g, cA.b);
    gl.uniform3f(this.uColorBLoc, cB.r, cB.g, cB.b);
    gl.uniform3f(this.uColorCLoc, cC.r, cC.g, cC.b);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 2. Draw burst spark particles
    if (this.activeParticles > 0) {
      gl.useProgram(this.particleProgram);
      gl.bindVertexArray(this.particleVao);

      gl.uniform2f(this.uParticleResLoc, this.width, this.height);
      gl.uniform1f(this.uParticleBrightLoc, this.parameters.brightness);
      gl.uniform3f(this.uParticleColALoc, cA.r, cA.g, cA.b);
      gl.uniform3f(this.uParticleColBLoc, cC.r, cC.g, cC.b);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      gl.drawArrays(gl.POINTS, 0, this.activeParticles);

      gl.disable(gl.BLEND);
    }
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
    if (this.quadVao) gl.deleteVertexArray(this.quadVao);
    if (this.quadProgram) gl.deleteProgram(this.quadProgram);

    if (this.particleVbo) gl.deleteBuffer(this.particleVbo);
    if (this.particleVao) gl.deleteVertexArray(this.particleVao);
    if (this.particleProgram) gl.deleteProgram(this.particleProgram);

    this.quadProgram = null;
    this.particleProgram = null;
    this.quadVao = null;
    this.quadVbo = null;
    this.particleVao = null;
    this.particleVbo = null;
    this.gl = null;
  }
}
