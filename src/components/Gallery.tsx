import React from "react";
import { LAUNCH_PRESETS } from "../types/catalog";
import { SceneId } from "../types/contracts";
import { Sparkles, Layers, Disc3, Radio, Compass, Orbit, Waves, Zap } from "lucide-react";

interface GalleryProps {
  selectedSceneId: SceneId;
  onSelectScene: (id: SceneId) => void;
}

const ICONS: Record<SceneId, React.ReactNode> = {
  pulse_ring: <Radio className="w-5 h-5 text-indigo-400" />,
  silk_wave: <Waves className="w-5 h-5 text-cyan-400" />,
  star_drift: <Orbit className="w-5 h-5 text-purple-400" />,
  neon_highway: <Zap className="w-5 h-5 text-pink-400" />,
  aurora: <Sparkles className="w-5 h-5 text-emerald-400" />,
  ripple: <Disc3 className="w-5 h-5 text-blue-400" />,
  prism: <Compass className="w-5 h-5 text-amber-400" />,
  shockwave: <Layers className="w-5 h-5 text-rose-400" />,
};

export const Gallery: React.FC<GalleryProps> = ({
  selectedSceneId,
  onSelectScene,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wider text-muted uppercase">
          Launch Presets (8 Available)
        </h2>
        <span className="text-xs text-muted/70 font-mono">MVP Collection</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {LAUNCH_PRESETS.map((preset) => {
          const isSelected = preset.id === selectedSceneId;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectScene(preset.id)}
              className={`p-3.5 rounded-xl text-left border transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? "bg-surface-elevated border-primary shadow-lg shadow-primary/20 ring-1 ring-primary"
                  : "bg-surface/60 border-white/5 hover:border-white/20 hover:bg-surface"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-white/5">
                    {ICONS[preset.id]}
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/5 text-muted">
                    {preset.collection}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-white mb-1">
                  {preset.name}
                </h3>
                <p className="text-xs text-muted leading-relaxed line-clamp-2">
                  {preset.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className={isSelected ? "text-primary font-medium" : "text-muted"}>
                  {isSelected ? "Active" : "Select"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
