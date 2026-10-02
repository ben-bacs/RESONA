use crate::types::{AppearanceParameters, LookRef, SettingsSnapshot, UserPreferences};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;

pub struct PersistenceService {
    config_dir: PathBuf,
}

impl PersistenceService {
    pub fn new(config_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&config_dir);
        Self { config_dir }
    }

    fn snapshot_path(&self) -> PathBuf {
        self.config_dir.join("settings.json")
    }

    fn backup_path(&self) -> PathBuf {
        self.config_dir.join("settings.bak")
    }

    fn temp_path(&self) -> PathBuf {
        self.config_dir.join("settings.tmp")
    }

    fn corrupt_path(&self) -> PathBuf {
        self.config_dir.join("settings.corrupt")
    }

    pub fn load_snapshot(&self) -> SettingsSnapshot {
        let primary = self.snapshot_path();
        if primary.exists() {
            match fs::read_to_string(&primary) {
                Ok(content) => match serde_json::from_str::<SettingsSnapshot>(&content) {
                    Ok(snapshot) => return snapshot,
                    Err(err) => {
                        eprintln!("Primary settings corrupted: {}, attempting backup...", err);
                        let _ = fs::rename(&primary, self.corrupt_path());
                    }
                },
                Err(err) => {
                    eprintln!("Failed to read primary settings: {}", err);
                }
            }
        }

        // Try backup if primary failed or does not exist
        let backup = self.backup_path();
        if backup.exists() {
            if let Ok(content) = fs::read_to_string(&backup) {
                if let Ok(snapshot) = serde_json::from_str::<SettingsSnapshot>(&content) {
                    eprintln!("Successfully recovered snapshot from backup.");
                    return snapshot;
                }
            }
        }

        // Default fallback
        let default_snap = SettingsSnapshot {
            revision: 0,
            ..SettingsSnapshot::default()
        };
        match self.save_snapshot(&default_snap, None) {
            Ok(saved) => saved,
            Err(_) => SettingsSnapshot::default(),
        }
    }

    pub fn save_snapshot(
        &self,
        snapshot: &SettingsSnapshot,
        expected_revision: Option<u64>,
    ) -> Result<SettingsSnapshot, String> {
        let primary = self.snapshot_path();

        // 1. Concurrency revision check if primary exists
        if let Some(expected) = expected_revision {
            if primary.exists() {
                if let Ok(content) = fs::read_to_string(&primary) {
                    if let Ok(current) = serde_json::from_str::<SettingsSnapshot>(&content) {
                        if current.revision != expected {
                            return Err(format!(
                                "Revision conflict: expected {}, found {}",
                                expected, current.revision
                            ));
                        }
                    }
                }
            }
        }

        // 2. Prepare next revision
        let mut next_snapshot = snapshot.clone();
        next_snapshot.revision += 1;

        let json = serde_json::to_string_pretty(&next_snapshot)
            .map_err(|e| format!("Serialization error: {}", e))?;

        // 3. Write and sync to temporary file on the same volume
        let temp = self.temp_path();
        {
            let mut file = File::create(&temp)
                .map_err(|e| format!("Failed to create temp file: {}", e))?;
            file.write_all(json.as_bytes())
                .map_err(|e| format!("Failed to write temp file: {}", e))?;
            file.sync_all()
                .map_err(|e| format!("Failed to sync temp file: {}", e))?;
        }

        // 4. Preserve existing primary as backup
        if primary.exists() {
            let backup = self.backup_path();
            let _ = fs::copy(&primary, &backup);
        }

        // 5. Atomic replacement (rename temp -> primary)
        fs::rename(&temp, &primary)
            .map_err(|e| format!("Atomic replace failed: {}", e))?;

        Ok(next_snapshot)
    }

    pub fn load_preferences(&self) -> UserPreferences {
        self.load_snapshot().preferences
    }

    pub fn save_preferences(&self, prefs: &UserPreferences) -> Result<(), String> {
        let mut snap = self.load_snapshot();
        snap.preferences = prefs.clone();
        self.save_snapshot(&snap, None)?;
        Ok(())
    }

    pub fn load_parameters(&self) -> AppearanceParameters {
        self.load_snapshot().committed_look.appearance
    }

    pub fn save_parameters(&self, params: &AppearanceParameters) -> Result<(), String> {
        let mut snap = self.load_snapshot();
        snap.committed_look.appearance = params.clone();
        self.save_snapshot(&snap, None)?;
        Ok(())
    }

    pub fn toggle_favorite(&self, look_ref: LookRef) -> Result<Vec<LookRef>, String> {
        let mut snap = self.load_snapshot();
        if let Some(pos) = snap.favorites.iter().position(|r| r == &look_ref) {
            snap.favorites.remove(pos);
        } else {
            snap.favorites.push(look_ref);
        }
        let updated = self.save_snapshot(&snap, None)?;
        Ok(updated.favorites)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_atomic_save_and_load_roundtrip() {
        let temp_dir = std::env::temp_dir().join("resona_test_persist_roundtrip");
        let _ = fs::remove_dir_all(&temp_dir);

        let service = PersistenceService::new(temp_dir.clone());
        let initial = service.load_snapshot();
        assert_eq!(initial.revision, 1);

        let mut updated = initial.clone();
        updated.preferences.idle_delay_sec = 120;
        let saved = service.save_snapshot(&updated, Some(1)).unwrap();
        assert_eq!(saved.revision, 2);
        assert_eq!(saved.preferences.idle_delay_sec, 120);

        let reloaded = service.load_snapshot();
        assert_eq!(reloaded.revision, 2);
        assert_eq!(reloaded.preferences.idle_delay_sec, 120);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_revision_concurrency_conflict() {
        let temp_dir = std::env::temp_dir().join("resona_test_persist_conflict");
        let _ = fs::remove_dir_all(&temp_dir);

        let service = PersistenceService::new(temp_dir.clone());
        let initial = service.load_snapshot(); // revision 1

        let mut mod_a = initial.clone();
        mod_a.preferences.idle_delay_sec = 90;
        let saved_a = service.save_snapshot(&mod_a, Some(1)).unwrap(); // advances to revision 2
        assert_eq!(saved_a.revision, 2);

        // Client B tries to save with stale revision 1 -> must fail with conflict!
        let mut mod_b = initial.clone();
        mod_b.preferences.idle_delay_sec = 150;
        let res = service.save_snapshot(&mod_b, Some(1));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Revision conflict"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_corrupt_file_recovery_and_backup() {
        let temp_dir = std::env::temp_dir().join("resona_test_persist_corrupt");
        let _ = fs::remove_dir_all(&temp_dir);

        let service = PersistenceService::new(temp_dir.clone());
        let initial = service.load_snapshot(); // creates valid settings.json
        assert_eq!(initial.revision, 1);

        // Corrupt primary file with garbage
        fs::write(service.snapshot_path(), b"INVALID NOT JSON").unwrap();

        // Loading should detect corruption and recover safely with default
        let recovered = service.load_snapshot();
        assert_eq!(recovered.schema_version, 1);
        assert!(service.corrupt_path().exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
