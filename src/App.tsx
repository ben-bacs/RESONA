import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { VisualizerCanvas } from "./components/VisualizerCanvas";
import { Gallery } from "./components/Gallery";
import { Controls } from "./components/Controls";
import { LAUNCH_PRESETS } from "./types/catalog";
import {
  AppearanceParameters,
  ImportReviewResponse,
  PresetVariation,
  SceneId,
  ShuffleConfig,
} from "./types/contracts";
import { IpcService } from "./services/ipc";
import { AlertCircle, Check, X } from "lucide-react";

export function App() {
  const [candidateSceneId, setCandidateSceneId] = useState<SceneId>("pulse_ring");
  const [committedSceneId, setCommittedSceneId] = useState<SceneId>("pulse_ring");
  const [favorites, setFavorites] = useState<SceneId[]>(["pulse_ring", "star_drift"]);
  const [variations, setVariations] = useState<PresetVariation[]>([]);
  const [revision, setRevision] = useState<number>(1);
  const [shuffleConfig, setShuffleConfig] = useState<ShuffleConfig>({
    enabled: false,
    source: "favorites",
    selected: [],
    intervalMinutes: 5,
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoIdleEnabled, setAutoIdleEnabled] = useState(true);

  // Import Review Dialog State
  const [importReview, setImportReview] = useState<ImportReviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initialPreset =
    LAUNCH_PRESETS.find((p) => p.id === candidateSceneId) || LAUNCH_PRESETS[0];
  const [parameters, setParameters] = useState<AppearanceParameters>(
    initialPreset.defaultParameters
  );

  // Load initial settings snapshot from IPC backend
  useEffect(() => {
    let isMounted = true;
    IpcService.getSettingsSnapshot().then((snapshot) => {
      if (!snapshot || !isMounted) return;
      setRevision(snapshot.revision);
      setCommittedSceneId(snapshot.committedLook.sceneId);
      setCandidateSceneId(snapshot.committedLook.sceneId);
      setParameters(snapshot.committedLook.appearance);
      setVariations(snapshot.variations);
      setAutoIdleEnabled(snapshot.preferences.autoEnabled);
      setShuffleConfig(snapshot.shuffle);

      // Extract builtin favorite scene IDs
      const favSceneIds: SceneId[] = snapshot.favorites
        .filter((r) => r.kind === "builtin")
        .map((r) => (r as { kind: "builtin"; scene_id: SceneId }).scene_id);
      if (favSceneIds.length > 0) {
        setFavorites(favSceneIds);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Step shuffler tick in fullscreen
  useEffect(() => {
    if (!isFullscreen || !shuffleConfig.enabled) return;

    const interval = setInterval(async () => {
      const nextLook = await IpcService.stepShuffler(1.0, true);
      if (nextLook) {
        if (nextLook.kind === "builtin") {
          setCandidateSceneId(nextLook.scene_id);
          const p = LAUNCH_PRESETS.find((preset) => preset.id === nextLook.scene_id);
          if (p) setParameters(p.defaultParameters);
        } else if (nextLook.kind === "variation") {
          const v = variations.find((item) => item.id === nextLook.id);
          if (v) {
            setCandidateSceneId(v.sceneId);
            setParameters(v.appearance);
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isFullscreen, shuffleConfig.enabled, variations]);

  const handleSelectScene = (id: SceneId) => {
    setCandidateSceneId(id);
    const preset = LAUNCH_PRESETS.find((p) => p.id === id);
    if (preset) {
      setParameters(preset.defaultParameters);
    }
  };

  const handleSelectVariation = (variation: PresetVariation) => {
    setCandidateSceneId(variation.sceneId);
    setParameters(variation.appearance);
  };

  const handleCommitLook = async () => {
    setCommittedSceneId(candidateSceneId);
    try {
      const snapshot = await IpcService.getSettingsSnapshot();
      if (snapshot) {
        snapshot.committedLook = {
          sceneId: candidateSceneId,
          appearanceVersion: 1,
          appearance: parameters,
          originVariationId: undefined,
        };
        const updated = await IpcService.saveSettingsSnapshot(snapshot, revision);
        setRevision(updated.revision);
      }
    } catch (err: unknown) {
      console.error("Save snapshot error:", err);
    }
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

  const handleCreateVariation = async (name: string) => {
    try {
      const updated = await IpcService.createVariation(
        name,
        candidateSceneId,
        parameters,
        revision
      );
      setRevision(updated.revision);
      setVariations(updated.variations);
    } catch (err: unknown) {
      setErrorMessage(String(err));
    }
  };

  const handleDeleteVariation = async (id: string) => {
    try {
      const updated = await IpcService.deleteVariation(id, revision);
      setRevision(updated.revision);
      setVariations(updated.variations);
    } catch (err: unknown) {
      setErrorMessage(String(err));
    }
  };

  const handleExportVariation = async (id: string) => {
    try {
      const jsonStr = await IpcService.exportVariation(id);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resona-variation-${id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setErrorMessage(String(err));
    }
  };

  const handleImportFile = async (jsonText: string) => {
    try {
      const review = await IpcService.beginImport(jsonText);
      setImportReview(review);
    } catch (err: unknown) {
      setErrorMessage(String(err));
    }
  };

  const handleCommitImport = async () => {
    if (!importReview) return;
    try {
      const updated = await IpcService.commitImport(importReview.token, revision);
      setRevision(updated.revision);
      setVariations(updated.variations);
      setImportReview(null);
    } catch (err: unknown) {
      setErrorMessage(String(err));
    }
  };

  const handleCancelImport = async () => {
    if (!importReview) return;
    await IpcService.cancelImport(importReview.token);
    setImportReview(null);
  };

  const handleChangeShuffleConfig = async (config: ShuffleConfig) => {
    setShuffleConfig(config);
    try {
      const updated = await IpcService.saveShuffleConfig(config, revision);
      setRevision(updated.revision);
    } catch (err: unknown) {
      console.error("Save shuffle config error:", err);
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
      {/* Error Toast */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-rose-500/90 text-white px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top duration-200">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs font-medium">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="ml-2 hover:opacity-75"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Import Review Modal */}
      {importReview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Review Variation Import
            </h3>
            <div className="bg-surface/50 border border-white/5 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Name:</span>
                <span className="font-semibold text-white">{importReview.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Scene Base:</span>
                <span className="font-semibold text-primary capitalize">
                  {importReview.sceneId.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Brightness:</span>
                <span>{Math.round(importReview.appearance.brightness * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Sensitivity:</span>
                <span>{importReview.appearance.sensitivity.toFixed(1)}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Palette:</span>
                <span className="capitalize">
                  {importReview.appearance.colorPalette.replace("_", " ")}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted leading-relaxed">
              Strict schema validated. Importing will securely store this preset under your personal variations collection.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                onClick={handleCancelImport}
                className="px-4 py-2 rounded-xl text-xs text-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitImport}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-medium shadow-md shadow-primary/20 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                Commit Import
              </button>
            </div>
          </div>
        </div>
      )}

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
              Interactive Preview
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/90 font-medium">
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
            onCreateVariation={handleCreateVariation}
            onImportFile={handleImportFile}
            shuffleConfig={shuffleConfig}
            onChangeShuffleConfig={handleChangeShuffleConfig}
          />

          <Gallery
            selectedSceneId={candidateSceneId}
            committedSceneId={committedSceneId}
            favorites={favorites}
            variations={variations}
            onSelectScene={handleSelectScene}
            onSelectVariation={handleSelectVariation}
            onToggleFavorite={handleToggleFavorite}
            onDeleteVariation={handleDeleteVariation}
            onExportVariation={handleExportVariation}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
