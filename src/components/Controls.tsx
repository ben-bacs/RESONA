import React from "react";
import { AppearanceParameters, SceneId } from "../types/contracts";
import {
  Maximize2,
  Sliders,
  RotateCcw,
  Volume2,
  Sun,
  Gauge,
  Eye,
  Check,
  Palette,
  Sparkles,
} from "lucide-react";

interface ControlsProps {
  selectedSceneId: SceneId;
  parameters: AppearanceParameters;
  onChangeParameters: (params: AppearanceParameters) => void;
  onResetDefaults: () => void;
  onCommitLook: () => void;
  isCommitted: boolean;
  onEnterFullscreen: () => void;
  autoIdleEnabled: boolean;
  onToggleAutoIdle: () => void;
}

const PALETTES = [
  { id: "neon_violet", label: "Neon Violet" },
  { id: "oceanic_azure", label: "Oceanic Azure" },
  { id: "deep_cosmos", label: "Deep Cosmos" },
  { id: "synthwave", label: "Synthwave" },
  { id: "boreal_glow", label: "Boreal Glow" },
  { id: "monochrome_silver", label: "Monochrome" },
  { id: "chromatic_prism", label: "Chromatic Prism" },
  { id: "solar_flare", label: "Solar Flare" },
];

export const Controls: React.FC<ControlsProps> = ({
  selectedSceneId,
  parameters,
  onChangeParameters,
  onResetDefaults,
  onCommitLook,
  isCommitted,
  onEnterFullscreen,
  autoIdleEnabled,
  onToggleAutoIdle,
}) => {
  const updateParam = (key: keyof AppearanceParameters, value: number | string) => {
    onChangeParameters({
      ...parameters,
      [key]: value,
    });
  };

  const updatePresetSpecific = (key: string, value: number) => {
    onChangeParameters({
      ...parameters,
      presetSpecific: {
        ...(parameters.presetSpecific || {}),
        [key]: value,
      },
    });
  };

  const renderSceneSpecificControls = () => {
    const specific = parameters.presetSpecific || {};

    switch (selectedSceneId) {
      case "pulse_ring": {
        const ringWidth = Number(specific.ringWidthPx ?? 3.0);
        const glow = Number(specific.glow ?? 0.35);
        return (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Ring Stroke</span>
                <span className="font-mono text-white/90">{ringWidth}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={ringWidth}
                aria-label="Adjust base ring stroke width in pixels"
                onChange={(e) => updatePresetSpecific("ringWidthPx", parseFloat(e.target.value))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Halo Glow Strength</span>
                <span className="font-mono text-white/90">{(glow * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={glow}
                aria-label="Adjust halo glow intensity"
                onChange={(e) => updatePresetSpecific("glow", parseFloat(e.target.value))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </>
        );
      }
      case "silk_wave": {
        const layers = Number(specific.layers ?? 3);
        const lineWidth = Number(specific.lineWidthPx ?? 2.0);
        return (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Ribbon Layers</span>
                <span className="font-mono text-white/90">{layers}</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={layers}
                aria-label="Adjust number of ribbon layers"
                onChange={(e) => updatePresetSpecific("layers", parseInt(e.target.value, 10))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Line Stroke</span>
                <span className="font-mono text-white/90">{lineWidth}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="0.5"
                value={lineWidth}
                aria-label="Adjust stroke thickness in pixels"
                onChange={(e) => updatePresetSpecific("lineWidthPx", parseFloat(e.target.value))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </>
        );
      }
      case "star_drift": {
        const density = Number(specific.density ?? 0.5);
        const travelSpeed = Number(specific.travelSpeed ?? 0.2);
        return (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Star Density</span>
                <span className="font-mono text-white/90">{Math.round(density * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={density}
                aria-label="Adjust particle cap density fraction"
                onChange={(e) => updatePresetSpecific("density", parseFloat(e.target.value))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Base Travel Speed</span>
                <span className="font-mono text-white/90">{travelSpeed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={travelSpeed}
                aria-label="Adjust scene depth travel speed"
                onChange={(e) => updatePresetSpecific("travelSpeed", parseFloat(e.target.value))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </>
        );
      }
      case "neon_highway": {
        const gridLines = Number(specific.gridLines ?? 24);
        const horizonGlow = Number(specific.horizonGlow ?? 0.4);
        return (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Grid Lines Density</span>
                <span className="font-mono text-white/90">{gridLines}</span>
              </div>
              <input
                type="range"
                min="8"
                max="64"
                step="4"
                value={gridLines}
                aria-label="Adjust grid lines per axis"
                onChange={(e) => updatePresetSpecific("gridLines", parseInt(e.target.value, 10))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Horizon Halo Intensity</span>
                <span className="font-mono text-white/90">{Math.round(horizonGlow * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={horizonGlow}
                aria-label="Adjust horizon halo glow intensity"
                onChange={(e) => updatePresetSpecific("horizonGlow", parseFloat(e.target.value))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </>
        );
      }
      case "aurora": {
        const curtainCount = Number(specific.curtainCount ?? 4);
        const flowSpeed = Number(specific.flowSpeed ?? 0.1);
        return (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Curtain Layers</span>
                <span className="font-mono text-white/90">{curtainCount}</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={curtainCount}
                aria-label="Adjust procedural curtain layer count"
                onChange={(e) => updatePresetSpecific("curtainCount", parseInt(e.target.value, 10))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Curtain Flow Speed</span>
                <span className="font-mono text-white/90">{flowSpeed.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.02"
                value={flowSpeed}
                aria-label="Adjust curtain flow speed"
                onChange={(e) => updatePresetSpecific("flowSpeed", parseFloat(e.target.value))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </>
        );
      }
      case "ripple": {
        const decaySeconds = Number(specific.decaySeconds ?? 2.0);
        const ringWidth = Number(specific.ringWidthPx ?? 2.0);
        return (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Wave Lifetime</span>
                <span className="font-mono text-white/90">{decaySeconds.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="6.0"
                step="0.25"
                value={decaySeconds}
                aria-label="Adjust ripple decay lifetime in seconds"
                onChange={(e) => updatePresetSpecific("decaySeconds", parseFloat(e.target.value))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Ring Stroke</span>
                <span className="font-mono text-white/90">{ringWidth}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="0.5"
                value={ringWidth}
                aria-label="Adjust ripple ring stroke in pixels"
                onChange={(e) => updatePresetSpecific("ringWidthPx", parseFloat(e.target.value))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </>
        );
      }
      case "prism": {
        const symmetry = Number(specific.symmetry ?? 6);
        const rotationDegPerSec = Number(specific.rotationDegPerSec ?? 6.0);
        return (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Symmetry Sectors</span>
                <span className="font-mono text-white/90">{symmetry}-fold</span>
              </div>
              <input
                type="range"
                min="2"
                max="16"
                step="1"
                value={symmetry}
                aria-label="Adjust kaleidoscope symmetry sectors"
                onChange={(e) => updatePresetSpecific("symmetry", parseInt(e.target.value, 10))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Rotational Velocity</span>
                <span className="font-mono text-white/90">{rotationDegPerSec.toFixed(0)}°/s</span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                step="2"
                value={rotationDegPerSec}
                aria-label="Adjust signed angular velocity in degrees per second"
                onChange={(e) => updatePresetSpecific("rotationDegPerSec", parseFloat(e.target.value))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </>
        );
      }
      case "shockwave": {
        const burstParticles = Number(specific.burstParticles ?? 64);
        const decaySeconds = Number(specific.decaySeconds ?? 0.8);
        return (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Burst Spark Count</span>
                <span className="font-mono text-white/90">{burstParticles}</span>
              </div>
              <input
                type="range"
                min="8"
                max="256"
                step="8"
                value={burstParticles}
                aria-label="Adjust particles per burst event"
                onChange={(e) => updatePresetSpecific("burstParticles", parseInt(e.target.value, 10))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Wave & Particle Lifetime</span>
                <span className="font-mono text-white/90">{decaySeconds.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={decaySeconds}
                aria-label="Adjust shockwave lifetime in seconds"
                onChange={(e) => updatePresetSpecific("decaySeconds", parseFloat(e.target.value))}
                className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="bg-surface/80 border border-white/5 rounded-2xl p-5 space-y-6 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wider text-muted uppercase">
            Appearance & Audio Tuning
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onResetDefaults}
            aria-label="Reset parameters to base defaults"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-white/5 focus-visible:ring-1 focus-visible:ring-primary"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            onClick={onCommitLook}
            disabled={isCommitted}
            aria-label="Commit current candidate look as default active look"
            className={`flex items-center gap-1.5 text-xs py-1.5 px-3.5 rounded-lg font-medium transition-all focus-visible:ring-1 focus-visible:ring-primary ${
              isCommitted
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default"
                : "bg-primary text-white hover:bg-primary-hover shadow-md shadow-primary/20"
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            {isCommitted ? "Committed Look" : "Save as Active"}
          </button>
        </div>
      </div>

      {/* Sliders Grid: Common Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Brightness */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <Sun className="w-3.5 h-3.5 text-amber-400" /> Brightness
            </span>
            <span className="font-mono text-white/90">
              {Math.round(parameters.brightness * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            aria-label="Adjust display brightness"
            value={parameters.brightness}
            onChange={(e) => updateParam("brightness", parseFloat(e.target.value))}
            className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        {/* Audio Sensitivity */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" /> Audio Sensitivity
            </span>
            <span className="font-mono text-white/90">
              {parameters.sensitivity.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3.0"
            step="0.1"
            aria-label="Adjust audio sensitivity multiplier"
            value={parameters.sensitivity}
            onChange={(e) => updateParam("sensitivity", parseFloat(e.target.value))}
            className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        {/* Motion Speed */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Motion Speed
            </span>
            <span className="font-mono text-white/90">
              {parameters.motionSpeed.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="0.2"
            max="2.0"
            step="0.05"
            aria-label="Adjust animation motion speed"
            value={parameters.motionSpeed}
            onChange={(e) => updateParam("motionSpeed", parseFloat(e.target.value))}
            className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        {/* Bloom / Glow */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <Eye className="w-3.5 h-3.5 text-pink-400" /> Bloom / Glow
            </span>
            <span className="font-mono text-white/90">
              {Math.round(parameters.bloomIntensity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            aria-label="Adjust bloom and glow intensity"
            value={parameters.bloomIntensity}
            onChange={(e) => updateParam("bloomIntensity", parseFloat(e.target.value))}
            className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Scene Specific Parameters Grid */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-muted mb-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium text-white/80">Scene Tuning ({selectedSceneId.replace("_", " ")})</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface/40 p-3 rounded-xl border border-white/5">
          {renderSceneSpecificControls()}
        </div>
      </div>

      {/* Palette Selection */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Palette className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium text-white/80">Trusted Color Palette</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label="Color Palette">
          {PALETTES.map((pal) => {
            const isSelected = parameters.colorPalette === pal.id;
            return (
              <button
                key={pal.id}
                role="radio"
                aria-checked={isSelected}
                onClick={() => updateParam("colorPalette", pal.id)}
                className={`text-xs px-3 py-1.5 rounded-xl border transition-all focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? "bg-primary/20 border-primary text-white font-medium shadow-sm"
                    : "bg-surface/50 border-white/5 text-muted hover:text-white hover:bg-surface"
                }`}
              >
                {pal.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
        <label className="flex items-center gap-3 cursor-pointer group text-xs text-muted">
          <input
            type="checkbox"
            checked={autoIdleEnabled}
            onChange={onToggleAutoIdle}
            className="w-4 h-4 rounded accent-primary bg-white/10 border-white/20 focus-visible:ring-2 focus-visible:ring-primary"
          />
          <span className="group-hover:text-white transition-colors">
            Auto-launch on idle (Windows 11)
          </span>
        </label>

        <button
          onClick={onEnterFullscreen}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-lg shadow-primary/25 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Maximize2 className="w-4 h-4" />
          Start Fullscreen
        </button>
      </div>
    </div>
  );
};
