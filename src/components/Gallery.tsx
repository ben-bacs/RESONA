import React, { useState } from "react";
import { LAUNCH_PRESETS } from "../types/catalog";
import { SceneId } from "../types/contracts";
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
} from "lucide-react";

interface GalleryProps {
  selectedSceneId: SceneId;
  committedSceneId: SceneId;
  favorites: SceneId[];
  onSelectScene: (id: SceneId) => void;
  onToggleFavorite: (id: SceneId) => void;
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

type Category = "All" | "Minimal" | "Cosmic" | "Vibrant" | "Atmospheric" | "Favorites";

export const Gallery: React.FC<GalleryProps> = ({
  selectedSceneId,
  committedSceneId,
  favorites,
  onSelectScene,
  onToggleFavorite,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const categories: Category[] = ["All", "Favorites", "Minimal", "Cosmic", "Vibrant", "Atmospheric"];

  const filteredPresets = LAUNCH_PRESETS.filter((preset) => {
    // Filter by Category
    if (selectedCategory === "Favorites") {
      if (!favorites.includes(preset.id)) return false;
    } else if (selectedCategory !== "All" && preset.collection !== selectedCategory) {
      return false;
    }

    // Filter by Search Query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchName = preset.name.toLowerCase().includes(q);
      const matchDesc = preset.description.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wider text-muted uppercase">
            Scene Gallery ({filteredPresets.length} Presets)
          </h2>
          <span className="text-xs text-muted/70 font-mono">
            {selectedCategory === "All" ? "All Launch Collections" : `${selectedCategory} Collection`}
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
              {cat === "Favorites" ? `★ Favorites (${favorites.length})` : cat}
            </button>
          );
        })}
      </div>

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {filteredPresets.map((preset) => {
          const isSelected = preset.id === selectedSceneId;
          const isCommitted = preset.id === committedSceneId;
          const isFav = favorites.includes(preset.id);

          return (
            <div
              key={preset.id}
              tabIndex={0}
              role="button"
              aria-label={`Select ${preset.name} visualizer`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectScene(preset.id);
                }
              }}
              onClick={() => onSelectScene(preset.id)}
              className={`p-3.5 rounded-xl text-left border transition-all duration-200 flex flex-col justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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

                  <div className="flex items-center gap-1.5">
                    <button
                      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(preset.id);
                      }}
                      className="p-1 rounded-md text-muted hover:text-amber-400 transition-colors focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          isFav ? "text-amber-400 fill-amber-400" : ""
                        }`}
                      />
                    </button>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/5 text-muted">
                      {preset.collection}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-medium text-white mb-1 flex items-center gap-1.5">
                  {preset.name}
                  {isCommitted && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Active Committed Look" />
                  )}
                </h3>

                <p className="text-xs text-muted leading-relaxed line-clamp-2">
                  {preset.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className={isSelected ? "text-primary font-medium" : "text-muted"}>
                  {isCommitted ? "Active Look" : isSelected ? "Previewing" : "Select"}
                </span>
                {isCommitted && (
                  <span className="text-[10px] text-emerald-400 font-mono uppercase">
                    Committed
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredPresets.length === 0 && (
        <div className="text-center py-8 bg-surface/30 border border-dashed border-white/10 rounded-xl">
          <p className="text-xs text-muted">No presets match the current filter criteria.</p>
        </div>
      )}
    </div>
  );
};
