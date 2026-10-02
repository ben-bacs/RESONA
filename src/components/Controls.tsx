import React from "react";
import { AppearanceParameters } from "../types/contracts";
import { Maximize2, Sliders, RotateCcw, Volume2, Sun, Gauge, Eye } from "lucide-react";

interface ControlsProps {
  parameters: AppearanceParameters;
  onChangeParameters: (params: AppearanceParameters) => void;
  onResetDefaults: () => void;
  onEnterFullscreen: () => void;
  autoIdleEnabled: boolean;
  onToggleAutoIdle: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  parameters,
  onChangeParameters,
  onResetDefaults,
  onEnterFullscreen,
  autoIdleEnabled,
  onToggleAutoIdle,
}) => {
  const updateParam = (key: keyof AppearanceParameters, value: number) => {
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
        <button
          onClick={onResetDefaults}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors py-1 px-2.5 rounded-lg hover:bg-white/5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

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
            value={parameters.brightness}
            onChange={(e) => updateParam("brightness", parseFloat(e.target.value))}
            className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer"
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
            value={parameters.sensitivity}
            onChange={(e) => updateParam("sensitivity", parseFloat(e.target.value))}
            className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer"
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
            value={parameters.motionSpeed}
            onChange={(e) => updateParam("motionSpeed", parseFloat(e.target.value))}
            className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer"
          />
        </div>

        {/* Bloom Intensity */}
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
            value={parameters.bloomIntensity}
            onChange={(e) => updateParam("bloomIntensity", parseFloat(e.target.value))}
            className="w-full accent-primary bg-white/10 rounded-lg h-1.5 cursor-pointer"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between pt-4 border-t border-white/5 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleAutoIdle}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-2 ${
              autoIdleEnabled
                ? "bg-primary/20 border-primary text-primary"
                : "bg-surface-elevated border-white/10 text-muted hover:text-white"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoIdleEnabled ? "bg-primary animate-pulse" : "bg-muted"}`} />
            Auto-Idle Visualizer: {autoIdleEnabled ? "Enabled (1 min delay)" : "Disabled"}
          </button>
        </div>

        <button
          onClick={onEnterFullscreen}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-primary/25 transition-all transform active:scale-95"
        >
          <Maximize2 className="w-4 h-4" />
          Launch Fullscreen Visualizer
        </button>
      </div>
    </div>
  );
};
