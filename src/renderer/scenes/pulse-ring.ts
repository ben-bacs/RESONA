import { IScene } from "../scene-contract";
import { AnalysisFrame, AppearanceParameters, QualityTier } from "../../types/contracts";

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

  private width = 800;
  private height = 600;
  private time = 0;
  private parameters: AppearanceParameters = {
    brightness: 0.85,
    sensitivity: 1.0,
    motionSpeed: 1.0,
    colorPalette: "neon_violet",
    bloomIntensity: 0.6,
  };

  private currentAnalysis: AnalysisFrame | null = null;

  initialize(gl: WebGL2RenderingContext, _quality: QualityTier, _seed?: number): boolean {
    this.gl = gl;

    const vsSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

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

      #define PI 3.14159265359

      void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
        float dist = length(uv);
        float angle = atan(uv.y, uv.x);
        if (angle < 0.0) angle += 2.0 * PI;

        // Sample band corresponding to angle around circle (mirrored for symmetry)
        float normalizedAngle = abs(angle / PI - 1.0);
        int bandIndex = int(clamp(normalizedAngle * 63.0, 0.0, 63.0));
        float bandEnergy = u_bands[bandIndex] * u_sensitivity;

        // Base ring radius modulated by audio loudness & transient
        float baseRadius = 0.45 + (u_rms * 0.15) + (u_transient * 0.08);
        float wave = sin(angle * 12.0 + u_time * 2.0) * (0.015 + bandEnergy * 0.08);
        float ringDistance = abs(dist - (baseRadius + wave));

        // Thickness & glow
        float thickness = 0.012 + (bandEnergy * 0.02);
        float glow = (thickness / max(ringDistance, 0.001)) * u_brightness;

        // Neon color gradient
        vec3 colA = vec3(0.39, 0.25, 0.95); // Deep Indigo/Violet
        vec3 colB = vec3(0.02, 0.85, 0.98); // Cyan/Aqua
        vec3 colC = vec3(0.98, 0.15, 0.65); // Magenta punch
        
        vec3 ringColor = mix(colA, colB, sin(angle + u_time) * 0.5 + 0.5);
        ringColor = mix(ringColor, colC, u_transient * 0.7);

        vec3 finalColor = ringColor * glow;

        // Ambient subtle background glow
        finalColor += colA * (0.04 * u_brightness * (1.0 - smoothstep(0.0, 1.2, dist)));

        fragColor = vec4(finalColor, 1.0);
      }
    `;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return false;

    const prog = gl.createProgram();
    if (!prog) return false;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Program link failed:", gl.getProgramInfoLog(prog));
      return false;
    }

    this.program = prog;

    // Fullscreen quad
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    this.uResolutionLoc = gl.getUniformLocation(prog, "u_resolution");
    this.uTimeLoc = gl.getUniformLocation(prog, "u_time");
    this.uBandsLoc = gl.getUniformLocation(prog, "u_bands");
    this.uRmsLoc = gl.getUniformLocation(prog, "u_rms");
    this.uTransientLoc = gl.getUniformLocation(prog, "u_transient");
    this.uBrightnessLoc = gl.getUniformLocation(prog, "u_brightness");
    this.uSensitivityLoc = gl.getUniformLocation(prog, "u_sensitivity");

    return true;
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
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
    this.time += deltaSeconds * this.parameters.motionSpeed;
    this.currentAnalysis = analysis;
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

    if (this.currentAnalysis) {
      gl.uniform1fv(this.uBandsLoc, this.currentAnalysis.bands);
      gl.uniform1f(this.uRmsLoc, this.currentAnalysis.rms);
      gl.uniform1f(this.uTransientLoc, this.currentAnalysis.transientStrength);
    } else {
      const emptyBands = new Float32Array(64);
      gl.uniform1fv(this.uBandsLoc, emptyBands);
      gl.uniform1f(this.uRmsLoc, 0.0);
      gl.uniform1f(this.uTransientLoc, 0.0);
    }

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
