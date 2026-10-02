import { useState } from "react";
import { Header } from "./components/Header";
import { VisualizerCanvas } from "./components/VisualizerCanvas";
import { Gallery } from "./components/Gallery";
import { Controls } from "./components/Controls";
import { LAUNCH_PRESETS } from "./types/catalog";
import { AppearanceParameters, SceneId } from "./types/contracts";

export function App() {
  const [selectedSceneId, setSelectedSceneId] = useState<SceneId>("pulse_ring");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoIdleEnabled, setAutoIdleEnabled] = useState(true);

  const initialPreset = LAUNCH_PRESETS.find((p) => p.id === selectedSceneId) || LAUNCH_PRESETS[0];
  const [parameters, setParameters] = useState<AppearanceParameters>(initialPreset.defaultParameters);

  const handleSelectScene = (id: SceneId) => {
    setSelectedSceneId(id);
    const preset = LAUNCH_PRESETS.find((p) => p.id === id);
    if (preset) {
      setParameters(preset.defaultParameters);
    }
  };

  const handleResetDefaults = () => {
    const preset = LAUNCH_PRESETS.find((p) => p.id === selectedSceneId);
    if (preset) {
      setParameters(preset.defaultParameters);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white p-6 flex flex-col gap-6 selection:bg-primary/30">
      {/* Fullscreen Overlay mode */}
      {isFullscreen && (
        <VisualizerCanvas
          sceneId={selectedSceneId}
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
            <span className="text-xs text-primary font-mono">WebGL2 Engine</span>
          </div>

          <div className="flex-1 min-h-[320px] bg-surface/50 border border-white/5 rounded-2xl overflow-hidden relative shadow-2xl">
            <VisualizerCanvas
              sceneId={selectedSceneId}
              parameters={parameters}
              isFullscreen={false}
            />
          </div>
        </section>

        {/* Right Column: Controls & Presets Gallery (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6 overflow-y-auto pr-1">
          <Controls
            parameters={parameters}
            onChangeParameters={setParameters}
            onResetDefaults={handleResetDefaults}
            onEnterFullscreen={() => setIsFullscreen(true)}
            autoIdleEnabled={autoIdleEnabled}
            onToggleAutoIdle={() => setAutoIdleEnabled(!autoIdleEnabled)}
          />

          <Gallery
            selectedSceneId={selectedSceneId}
            onSelectScene={handleSelectScene}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
