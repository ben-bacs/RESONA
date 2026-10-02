import React from "react";
import { AppearanceParameters } from "../types/contracts";
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
} from "lucide-react";

interface ControlsProps {
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
  { id: "solar_flare", label: "Solar Flare" },
];

export const Controls: React.FC<ControlsProps> = ({
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

      {/* Sliders Grid */}
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

      {/* Palette Selection */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Palette className="w-3.5 h-3.5 text-primary" />
          <span>Color Palette</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PALETTES.map((pal) => (
            <button
              key={pal.id}
              onClick={() => updateParam("colorPalette", pal.id)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                parameters.colorPalette === pal.id
                  ? "bg-primary/20 border-primary text-primary font-medium"
                  : "bg-surface border-white/5 text-muted hover:text-white hover:bg-surface-elevated"
              }`}
            >
              {pal.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions & Toggles */}
      <div className="flex flex-wrap items-center justify-between pt-4 border-t border-white/5 gap-4">
        <button
          onClick={onToggleAutoIdle}
          aria-label="Toggle auto-idle visualizer activation"
          className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-2 ${
            autoIdleEnabled
              ? "bg-primary/20 border-primary text-primary"
              : "bg-surface-elevated border-white/10 text-muted hover:text-white"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              autoIdleEnabled ? "bg-primary animate-pulse" : "bg-muted"
            }`}
          />
          Auto-Idle Mode: {autoIdleEnabled ? "Enabled (1m idle)" : "Disabled"}
        </button>

        <button
          onClick={onEnterFullscreen}
          aria-label="Launch Fullscreen Visualizer immediately"
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-primary/25 transition-all transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Maximize2 className="w-4 h-4" />
          Launch Fullscreen Visualizer
        </button>
      </div>
    </div>
  );
};
