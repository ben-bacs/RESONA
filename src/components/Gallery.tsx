import React, { useState } from "react";
import { LAUNCH_PRESETS } from "../types/catalog";
import { PresetVariation, SceneId } from "../types/contracts";
import {
  Sparkles,
  Layers,
  Disc3,
  Radio,
  Compass,
  Orbit,
  Waves,
  Zap,
  Star,
  Search,
  Download,
  Trash2,
  FolderHeart,
} from "lucide-react";

interface GalleryProps {
  selectedSceneId: SceneId;
  committedSceneId: SceneId;
  favorites: SceneId[];
  variations: PresetVariation[];
  onSelectScene: (id: SceneId) => void;
  onSelectVariation: (variation: PresetVariation) => void;
  onToggleFavorite: (id: SceneId) => void;
  onDeleteVariation: (id: string) => void;
  onExportVariation: (id: string) => void;
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

type Category =
  | "All"
  | "Favorites"
  | "My Variations"
  | "Minimal"
  | "Cosmic"
  | "Vibrant"
  | "Atmospheric";

export const Gallery: React.FC<GalleryProps> = ({
  selectedSceneId,
  committedSceneId,
  favorites,
  variations,
  onSelectScene,
  onSelectVariation,
  onToggleFavorite,
  onDeleteVariation,
  onExportVariation,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const categories: Category[] = [
    "All",
    "Favorites",
    "My Variations",
    "Minimal",
    "Cosmic",
    "Vibrant",
    "Atmospheric",
  ];

  const filteredPresets = LAUNCH_PRESETS.filter((preset) => {
    if (selectedCategory === "Favorites") {
      if (!favorites.includes(preset.id)) return false;
    } else if (selectedCategory === "My Variations") {
      return false; // Handled separately
    } else if (selectedCategory !== "All" && preset.collection !== selectedCategory) {
      return false;
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchName = preset.name.toLowerCase().includes(q);
      const matchDesc = preset.description.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }

    return true;
  });

  const filteredVariations = variations.filter((v) => {
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return v.name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wider text-muted uppercase">
            Scene Gallery ({selectedCategory === "My Variations" ? filteredVariations.length : filteredPresets.length} Items)
          </h2>
          <span className="text-xs text-muted/70 font-mono">
            {selectedCategory === "All"
              ? "All Launch Collections"
              : selectedCategory === "My Variations"
              ? "Custom User Variations"
              : `${selectedCategory} Collection`}
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search scenes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs bg-surface/70 border border-white/10 rounded-xl text-white placeholder-muted/60 focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-44 transition-all"
          />
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="tablist">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "bg-surface/50 text-muted hover:text-white hover:bg-surface border border-white/5"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Variations View */}
      {selectedCategory === "My Variations" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
          {filteredVariations.length === 0 ? (
            <div className="col-span-full py-8 text-center bg-surface/30 border border-white/5 rounded-2xl p-6 space-y-2">
              <FolderHeart className="w-8 h-8 text-muted mx-auto opacity-50" />
              <p className="text-xs text-muted font-medium">No custom variations created yet.</p>
              <p className="text-[11px] text-muted/60">
                Tune appearance settings and click "Save as New Variation" in the editor.
              </p>
            </div>
          ) : (
            filteredVariations.map((v) => (
              <div
                key={v.id}
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-white/5 bg-surface/40 hover:bg-surface/70 hover:border-white/10 transition-all text-left"
              >
                <div
                  className="cursor-pointer"
                  onClick={() => onSelectVariation(v)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-white/5 group-hover:scale-105 transition-transform">
                      {ICONS[v.sceneId] || <Radio className="w-5 h-5 text-primary" />}
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                      Variation
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-white/95 group-hover:text-primary transition-colors">
                    {v.name}
                  </h3>
                  <p className="text-[11px] text-muted/80 line-clamp-1 mt-0.5">
                    Based on {v.sceneId.replace("_", " ")}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-muted/60 font-mono">
                    Bri {Math.round(v.appearance.brightness * 100)}% · Sens {v.appearance.sensitivity.toFixed(1)}x
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportVariation(v.id);
                      }}
                      title="Export variation as JSON"
                      className="p-1 rounded text-muted hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteVariation(v.id);
                      }}
                      title="Delete variation"
                      className="p-1 rounded text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Presets Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
          {filteredPresets.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs text-muted">
              No scenes found matching criteria.
            </div>
          ) : (
            filteredPresets.map((preset) => {
              const isSelected = selectedSceneId === preset.id;
              const isCommitted = committedSceneId === preset.id;
              const isFav = favorites.includes(preset.id);

              return (
                <div
                  key={preset.id}
                  onClick={() => onSelectScene(preset.id)}
                  className={`group relative flex flex-col justify-between p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "bg-surface border-primary shadow-lg shadow-primary/10 ring-1 ring-primary"
                      : "bg-surface/40 border-white/5 hover:border-white/10 hover:bg-surface/70"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-lg bg-white/5 group-hover:scale-105 transition-transform">
                        {ICONS[preset.id]}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(preset.id);
                          }}
                          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                          className={`p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                            isFav
                              ? "text-amber-400 hover:bg-amber-400/10"
                              : "text-muted hover:text-white hover:bg-white/5"
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${isFav ? "fill-amber-400" : ""}`} />
                        </button>

                        {isCommitted && (
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="text-xs font-semibold text-white/95 group-hover:text-primary transition-colors">
                      {preset.name}
                    </h3>
                    <p className="text-[11px] text-muted/80 line-clamp-2 mt-1 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                    <span className="text-[10px] text-muted/60 font-mono">
                      {preset.collection}
                    </span>
                    <span className="text-[10px] text-primary/80 font-medium">
                      {isSelected ? "Inspecting" : "Select"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
