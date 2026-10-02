import { useState } from "react";
import { Header } from "./components/Header";
import { VisualizerCanvas } from "./components/VisualizerCanvas";
import { Gallery } from "./components/Gallery";
import { Controls } from "./components/Controls";
import { LAUNCH_PRESETS } from "./types/catalog";
import { AppearanceParameters, SceneId } from "./types/contracts";

export function App() {
  const [candidateSceneId, setCandidateSceneId] = useState<SceneId>("pulse_ring");
  const [committedSceneId, setCommittedSceneId] = useState<SceneId>("pulse_ring");
  const [favorites, setFavorites] = useState<SceneId[]>(["pulse_ring", "star_drift"]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoIdleEnabled, setAutoIdleEnabled] = useState(true);

  const initialPreset =
    LAUNCH_PRESETS.find((p) => p.id === candidateSceneId) || LAUNCH_PRESETS[0];
  const [parameters, setParameters] = useState<AppearanceParameters>(
    initialPreset.defaultParameters
  );

  const handleSelectScene = (id: SceneId) => {
    setCandidateSceneId(id);
    const preset = LAUNCH_PRESETS.find((p) => p.id === id);
    if (preset) {
      setParameters(preset.defaultParameters);
    }
  };

  const handleCommitLook = () => {
    setCommittedSceneId(candidateSceneId);
  };

  const handleToggleFavorite = (id: SceneId) => {
    if (favorites.includes(id)) {
      setFavorites(favorites.filter((f) => f !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  const handleResetDefaults = () => {
    const preset = LAUNCH_PRESETS.find((p) => p.id === candidateSceneId);
    if (preset) {
      setParameters(preset.defaultParameters);
    }
  };

  const isCommitted =
    candidateSceneId === committedSceneId &&
    JSON.stringify(parameters) ===
      JSON.stringify(
        LAUNCH_PRESETS.find((p) => p.id === committedSceneId)?.defaultParameters
      );

  return (
    <div className="min-h-screen bg-background text-white p-6 flex flex-col gap-6 selection:bg-primary/30">
      {/* Fullscreen Overlay mode */}
      {isFullscreen && (
        <VisualizerCanvas
          sceneId={candidateSceneId}
          parameters={parameters}
          isFullscreen={true}
          onExitFullscreen={() => setIsFullscreen(false)}
        />
      )}

      {/* Main Settings & Gallery Window */}
      <Header />

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Left Column: Interactive WebGL2 Preview (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wider text-muted uppercase">
              Live Preview
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary font-mono">
                {LAUNCH_PRESETS.find((p) => p.id === candidateSceneId)?.name}
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/5 text-muted">
                Candidate Draft
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[340px] bg-surface/50 border border-white/5 rounded-2xl overflow-hidden relative shadow-2xl">
            <VisualizerCanvas
              sceneId={candidateSceneId}
              parameters={parameters}
              isFullscreen={false}
            />
          </div>
        </section>

        {/* Right Column: Controls & Presets Gallery (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6 overflow-y-auto pr-1">
          <Controls
            selectedSceneId={candidateSceneId}
            parameters={parameters}
            onChangeParameters={setParameters}
            onResetDefaults={handleResetDefaults}
            onCommitLook={handleCommitLook}
            isCommitted={isCommitted}
            onEnterFullscreen={() => setIsFullscreen(true)}
            autoIdleEnabled={autoIdleEnabled}
            onToggleAutoIdle={() => setAutoIdleEnabled(!autoIdleEnabled)}
          />

          <Gallery
            selectedSceneId={candidateSceneId}
            committedSceneId={committedSceneId}
            favorites={favorites}
            onSelectScene={handleSelectScene}
            onToggleFavorite={handleToggleFavorite}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
