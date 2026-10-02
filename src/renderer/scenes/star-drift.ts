import { IScene } from "../scene-contract";
import { AnalysisFrame, AppearanceParameters, QualityTier } from "../../types/contracts";
import { compileShader } from "../gl-utils";
import { resolvePalette } from "../palette-utils";

export class StarDriftScene implements IScene {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;

  // Uniform locations
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uBrightnessLoc: WebGLUniformLocation | null = null;
  private uTrebleLoc: WebGLUniformLocation | null = null;
  private uTransientLoc: WebGLUniformLocation | null = null;
  private uColorALoc: WebGLUniformLocation | null = null;
  private uColorBLoc: WebGLUniformLocation | null = null;
  private uColorCLoc: WebGLUniformLocation | null = null;

  private width = 800;
  private height = 600;

  // Particle pool
  private maxParticles = 4096;
  private activeCount = 2048;
  // 5 floats per particle: x, y, z, seed, size
  private particleData: Float32Array = new Float32Array(4096 * 5);

  private smoothedBass = 0;
  private smoothedTreble = 0;
  private smoothedTransient = 0;

  private parameters: AppearanceParameters = {
    brightness: 0.9,
    sensitivity: 1.1,
    motionSpeed: 1.2,
    colorPalette: "deep_cosmos",
    bloomIntensity: 0.7,
    presetSpecific: {
      density: 0.5,
      travelSpeed: 0.2,
    },
  };

  initialize(gl: WebGL2RenderingContext, quality: QualityTier, seed = 12345): boolean {
    this.gl = gl;

    // Quality caps per SDD Section 9
    this.maxParticles = quality === "low" ? 512 : quality === "medium" ? 2048 : 4096;
    this.particleData = new Float32Array(this.maxParticles * 5);

    // Initialize particles using deterministic pseudo-random sequence
    let s = seed || 12345;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    for (let i = 0; i < this.maxParticles; i++) {
      const idx = i * 5;
      this.particleData[idx] = (rnd() - 0.5) * 2.0; // x in [-1, 1]
      this.particleData[idx + 1] = (rnd() - 0.5) * 2.0; // y in [-1, 1]
      this.particleData[idx + 2] = rnd(); // z in [0, 1] (depth)
      this.particleData[idx + 3] = rnd(); // phase / seed
      this.particleData[idx + 4] = 1.0 + rnd() * 2.5; // base size
    }

    const vsSource = `#version 300 es
      in vec4 a_particle; // x, y, z, seed
      in float a_size;
      out float v_depth;
      out float v_seed;

      uniform vec2 u_resolution;
      uniform float u_treble;
      uniform float u_transient;

      void main() {
        v_depth = a_particle.z;
        v_seed = a_particle.w;

        // Perspective projection: closer stars (smaller z) appear spread out
        float z = max(a_particle.z, 0.05);
        vec2 projectedPos = a_particle.xy / z;

        // Keep aspect ratio
        float aspect = u_resolution.x / u_resolution.y;
        projectedPos.x /= aspect;

        gl_Position = vec4(projectedPos, 0.0, 1.0);

        // Point size grows as stars approach viewer + high frequency twinkle
        float sparkle = sin(v_seed * 6.28 + u_treble * 10.0) * 0.4 + 0.6;
        float pSize = (a_size / z) * sparkle * (1.0 + u_transient * 0.5);
        gl_PointSize = clamp(pSize, 1.5, 28.0);
      }
    `;

    const fsSource = `#version 300 es
      precision highp float;
      in float v_depth;
      in float v_seed;
      out vec4 fragColor;

      uniform float u_brightness;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      uniform vec3 u_colorC;

      void main() {
        if (u_brightness <= 0.001) {
          fragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        // Circular soft falloff
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;

        float alpha = smoothstep(0.5, 0.05, dist);

        // Color based on seed and depth
        vec3 starCol = mix(u_colorA, u_colorB, v_seed);
        if (v_depth < 0.2) {
          starCol = mix(starCol, u_colorC, (0.2 - v_depth) * 5.0);
        }

        // Fade in from distant darkness
        float depthFade = smoothstep(1.0, 0.7, v_depth);
        vec3 col = starCol * alpha * u_brightness * (0.4 + depthFade * 0.6);

        fragColor = vec4(col, 1.0);
      }
    `;

    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return false;

    const prog = gl.createProgram();
    if (!prog) return false;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("StarDrift program link failed:", gl.getProgramInfoLog(prog));
      return false;
    }
    this.program = prog;

    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.particleData, gl.DYNAMIC_DRAW);

    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
    const aParticleLoc = gl.getAttribLocation(prog, "a_particle");
    if (aParticleLoc >= 0) {
      gl.enableVertexAttribArray(aParticleLoc);
      gl.vertexAttribPointer(aParticleLoc, 4, gl.FLOAT, false, stride, 0);
    }

    const aSizeLoc = gl.getAttribLocation(prog, "a_size");
    if (aSizeLoc >= 0) {
      gl.enableVertexAttribArray(aSizeLoc);
      gl.vertexAttribPointer(aSizeLoc, 1, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
    }

    gl.bindVertexArray(null);

    this.uResolutionLoc = gl.getUniformLocation(prog, "u_resolution");
    this.uBrightnessLoc = gl.getUniformLocation(prog, "u_brightness");
    this.uTrebleLoc = gl.getUniformLocation(prog, "u_treble");
    this.uTransientLoc = gl.getUniformLocation(prog, "u_transient");
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
    const density = Math.min(1.0, Math.max(0.1, Number(params.presetSpecific?.density ?? 0.5)));
    this.activeCount = Math.round(this.maxParticles * density);
  }

  update(deltaSeconds: number, analysis: AnalysisFrame): void {
    const dt = Math.min(deltaSeconds, 0.05);

    const isSilent = !analysis || analysis.activity === "Silent";
    const factor = Math.min(1.0, dt * (isSilent ? 4.0 : 12.0));

    const targetBass = isSilent ? 0.0 : analysis.bass * this.parameters.sensitivity;
    const targetTreble = isSilent ? 0.0 : analysis.treble * this.parameters.sensitivity;
    const targetTransient = isSilent ? 0.0 : analysis.transientStrength;

    this.smoothedBass += (targetBass - this.smoothedBass) * factor;
    this.smoothedTreble += (targetTreble - this.smoothedTreble) * factor;
    this.smoothedTransient += (targetTransient - this.smoothedTransient) * factor;

    // Effective travel speed (zero under reduced motion)
    const travelSpeedParam = Number(this.parameters.presetSpecific?.travelSpeed ?? 0.2);
    const speed = travelSpeedParam * this.parameters.motionSpeed * (0.3 + this.smoothedBass * 1.8);

    // Update particle Z positions with recycling
    for (let i = 0; i < this.activeCount; i++) {
      const idx = i * 5;
      let z = this.particleData[idx + 2] - speed * dt;
      if (z <= 0.02) {
        // Recycle back to far plane
        z = 1.0;
        // Pseudo-randomize XY on recycle
        this.particleData[idx] = (Math.random() - 0.5) * 2.0;
        this.particleData[idx + 1] = (Math.random() - 0.5) * 2.0;
      }
      this.particleData[idx + 2] = z;
    }

    // Upload updated positions to GPU buffer
    if (this.gl && this.vbo) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbo);
      this.gl.bufferSubData(
        this.gl.ARRAY_BUFFER,
        0,
        this.particleData.subarray(0, this.activeCount * 5)
      );
    }
  }

  render(): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao) return;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniform2f(this.uResolutionLoc, this.width, this.height);
    gl.uniform1f(this.uBrightnessLoc, this.parameters.brightness);
    gl.uniform1f(this.uTrebleLoc, this.smoothedTreble);
    gl.uniform1f(this.uTransientLoc, this.smoothedTransient);

    const [cA, cB, cC] = resolvePalette(this.parameters.colorPalette);
    gl.uniform3f(this.uColorALoc, cA.r, cA.g, cA.b);
    gl.uniform3f(this.uColorBLoc, cB.r, cB.g, cB.b);
    gl.uniform3f(this.uColorCLoc, cC.r, cC.g, cC.b);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending for starry glow

    gl.drawArrays(gl.POINTS, 0, this.activeCount);

    gl.disable(gl.BLEND);
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
