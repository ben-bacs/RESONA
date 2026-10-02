import React, { useEffect, useRef } from "react";
import { SceneManager } from "../renderer/scene-manager";
import { AppearanceParameters, SceneId } from "../types/contracts";
import { IpcService } from "../services/ipc";

interface VisualizerCanvasProps {
  sceneId: SceneId;
  parameters: AppearanceParameters;
  isFullscreen?: boolean;
  onExitFullscreen?: () => void;
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  sceneId,
  parameters,
  isFullscreen = false,
  onExitFullscreen,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const managerRef = useRef<SceneManager | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const manager = new SceneManager(canvasRef.current);
    managerRef.current = manager;
    manager.setScene(sceneId, parameters);
    manager.start();

    // Initial resize once DOM layout is calculated
    manager.handleResize();

    const handleResize = () => {
      manager.handleResize();
    };

    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      manager.handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  // Poll latest native WASAPI loopback analysis frame
  useEffect(() => {
    let isRunning = true;
    let inFlight = false;

    const interval = setInterval(async () => {
      if (!isRunning || inFlight) return;
      inFlight = true;
      try {
        const frame = await IpcService.getLatestAnalysisFrame();
        if (frame && isRunning && managerRef.current) {
          managerRef.current.updateAnalysisFrame(frame);
        }
      } catch {
        // Handled via synthetic ambient motion
      } finally {
        inFlight = false;
      }
    }, 30); // ~33 Hz audio frame synchronization

    return () => {
      isRunning = false;
      clearInterval(interval);
    };
  }, []);

  // Update scene when sceneId changes
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setScene(sceneId, parameters);
    }
  }, [sceneId]);

  // Update parameters when user modifies sliders
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.applyParameters(parameters);
    }
  }, [parameters]);

  // Listen for Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen && onExitFullscreen) {
        onExitFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, onExitFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${isFullscreen ? "fixed inset-0 z-50 bg-black" : "rounded-2xl"}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-pointer"
        onClick={() => {
          if (isFullscreen && onExitFullscreen) {
            onExitFullscreen();
          }
        }}
      />
      {isFullscreen && (
        <div className="absolute top-4 right-4 text-xs font-mono text-white/50 bg-black/60 px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-md">
          Press ESC or click to exit fullscreen
        </div>
      )}
    </div>
  );
};
