import { invoke } from "@tauri-apps/api/core";
import {
  AnalysisFrame,
  AppearanceParameters,
  ImportReviewResponse,
  LookRef,
  SceneId,
  SettingsSnapshot,
  ShuffleConfig,
} from "../types/contracts";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    return await invoke<T>(cmd, args);
  }
  throw new Error(`Running outside Tauri runtime: command '${cmd}' simulated.`);
}

export const IpcService = {
  async getSettingsSnapshot(): Promise<SettingsSnapshot | null> {
    try {
      return await safeInvoke<SettingsSnapshot>("get_settings_snapshot");
    } catch {
      return null;
    }
  },

  async saveSettingsSnapshot(
    snapshot: SettingsSnapshot,
    expectedRevision?: number
  ): Promise<SettingsSnapshot> {
    return await safeInvoke<SettingsSnapshot>("save_settings_snapshot", {
      snapshot,
      expectedRevision,
    });
  },

  async createVariation(
    name: string,
    sceneId: SceneId,
    appearance: AppearanceParameters,
    expectedRevision?: number
  ): Promise<SettingsSnapshot> {
    return await safeInvoke<SettingsSnapshot>("create_variation", {
      name,
      sceneId,
      appearance,
      expectedRevision,
    });
  },

  async updateVariation(
    id: string,
    appearance: AppearanceParameters,
    expectedRevision?: number
  ): Promise<SettingsSnapshot> {
    return await safeInvoke<SettingsSnapshot>("update_variation", {
      id,
      appearance,
      expectedRevision,
    });
  },

  async renameVariation(
    id: string,
    newName: string,
    expectedRevision?: number
  ): Promise<SettingsSnapshot> {
    return await safeInvoke<SettingsSnapshot>("rename_variation", {
      id,
      newName,
      expectedRevision,
    });
  },

  async deleteVariation(
    id: string,
    expectedRevision?: number
  ): Promise<SettingsSnapshot> {
    return await safeInvoke<SettingsSnapshot>("delete_variation", {
      id,
      expectedRevision,
    });
  },

  async beginImport(jsonString: string): Promise<ImportReviewResponse> {
    return await safeInvoke<ImportReviewResponse>("begin_import", {
      jsonString,
    });
  },

  async commitImport(
    token: string,
    expectedRevision?: number
  ): Promise<SettingsSnapshot> {
    return await safeInvoke<SettingsSnapshot>("commit_import", {
      token,
      expectedRevision,
    });
  },

  async cancelImport(token: string): Promise<void> {
    try {
      await safeInvoke<void>("cancel_import", { token });
    } catch {
      // Ignore
    }
  },

  async exportVariation(id: string): Promise<string> {
    return await safeInvoke<string>("export_variation", { id });
  },

  async saveShuffleConfig(
    config: ShuffleConfig,
    expectedRevision?: number
  ): Promise<SettingsSnapshot> {
    return await safeInvoke<SettingsSnapshot>("save_shuffle_config", {
      config,
      expectedRevision,
    });
  },

  async stepShuffler(
    deltaSec: number,
    isFullscreenVisible: boolean
  ): Promise<LookRef | null> {
    try {
      return await safeInvoke<LookRef | null>("step_shuffler", {
        deltaSec,
        isFullscreenVisible,
      });
    } catch {
      return null;
    }
  },

  async getLatestAnalysisFrame(): Promise<AnalysisFrame | null> {
    try {
      return await safeInvoke<AnalysisFrame | null>("get_latest_analysis_frame");
    } catch {
      return null;
    }
  },
};
