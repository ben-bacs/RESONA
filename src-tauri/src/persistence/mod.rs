pub mod import_export;

use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use crate::types::{
    AppearanceParameters, CommittedLook, ImportReviewResponse, LookRef, PresetVariation,
    SceneId, SettingsSnapshot, UserPreferences,
};
use import_export::{
    serialize_for_export, validate_import_json, ImportTokenManager, InertVariationPayload,
};

#[repr(C)]
#[derive(Clone, Copy)]
struct WinGuid {
    data1: u32,
    data2: u16,
    data3: u16,
    data4: [u8; 8],
}

extern "system" {
    fn CoCreateGuid(pguid: *mut WinGuid) -> i32;
}

pub fn generate_uuid() -> String {
    let mut guid = WinGuid {
        data1: 0,
        data2: 0,
        data3: 0,
        data4: [0; 8],
    };
    unsafe {
        let _ = CoCreateGuid(&mut guid);
    }
    format!(
        "{:08x}-{:04x}-{:04x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        guid.data1,
        guid.data2,
        guid.data3,
        guid.data4[0],
        guid.data4[1],
        guid.data4[2],
        guid.data4[3],
        guid.data4[4],
        guid.data4[5],
        guid.data4[6],
        guid.data4[7]
    )
}

pub fn validate_variation_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    let char_count = trimmed.chars().count();
    if char_count == 0 {
        return Err("Variation name cannot be empty".to_string());
    }
    if char_count > 40 {
        return Err(format!(
            "Variation name exceeds maximum of 40 characters (got {})",
            char_count
        ));
    }
    for c in trimmed.chars() {
        if c.is_control() {
            return Err("Variation name contains forbidden control characters".to_string());
        }
    }
    Ok(trimmed.to_string())
}

pub struct PersistenceService {
    app_data_dir: PathBuf,
    import_tokens: ImportTokenManager,
}

impl PersistenceService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&app_data_dir);
        Self {
            app_data_dir,
            import_tokens: ImportTokenManager::new(),
        }
    }

    fn snapshot_path(&self) -> PathBuf {
        self.app_data_dir.join("settings.json")
    }

    fn temp_path(&self) -> PathBuf {
        self.app_data_dir.join("settings.tmp")
    }

    fn backup_path(&self) -> PathBuf {
        self.app_data_dir.join("settings.bak")
    }

    pub fn corrupt_path(&self) -> PathBuf {
        self.app_data_dir.join("settings.corrupt")
    }

    pub fn load_snapshot(&self) -> SettingsSnapshot {
        let primary = self.snapshot_path();
        if primary.exists() {
            match fs::read_to_string(&primary) {
                Ok(content) => match serde_json::from_str::<SettingsSnapshot>(&content) {
                    Ok(snapshot) => return snapshot,
                    Err(err) => {
                        eprintln!("Corrupt primary settings snapshot detected: {}, quarantining...", err);
                        let _ = fs::rename(&primary, self.corrupt_path());
                    }
                },
                Err(err) => {
                    eprintln!("Failed to read primary settings: {}", err);
                }
            }
        }

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

    // --- Variations CRUD ---

    pub fn create_variation(
        &self,
        name: String,
        scene_id: SceneId,
        appearance: AppearanceParameters,
        expected_revision: Option<u64>,
    ) -> Result<SettingsSnapshot, String> {
        let validated_name = validate_variation_name(&name)?;
        let mut snap = self.load_snapshot();

        if snap.variations.len() >= 500 {
            return Err("Limit exceeded: maximum 500 variations allowed".to_string());
        }

        let new_id = generate_uuid();
        let variation = PresetVariation {
            id: new_id.clone(),
            name: validated_name,
            scene_id,
            appearance_version: 1,
            appearance: appearance.clone(),
        };

        snap.variations.push(variation);

        // Commit active look to new variation
        snap.committed_look = CommittedLook {
            scene_id,
            appearance_version: 1,
            appearance,
            origin_variation_id: Some(new_id),
        };

        self.save_snapshot(&snap, expected_revision)
    }

    pub fn update_variation(
        &self,
        id: &str,
        appearance: AppearanceParameters,
        expected_revision: Option<u64>,
    ) -> Result<SettingsSnapshot, String> {
        let mut snap = self.load_snapshot();
        let var_idx = snap
            .variations
            .iter()
            .position(|v| v.id == id)
            .ok_or_else(|| format!("Variation with id '{}' not found", id))?;

        snap.variations[var_idx].appearance = appearance.clone();

        // If active look origin matches, update active look
        if snap.committed_look.origin_variation_id.as_deref() == Some(id) {
            snap.committed_look.appearance = appearance;
        }

        self.save_snapshot(&snap, expected_revision)
    }

    pub fn rename_variation(
        &self,
        id: &str,
        new_name: &str,
        expected_revision: Option<u64>,
    ) -> Result<SettingsSnapshot, String> {
        let validated_name = validate_variation_name(new_name)?;
        let mut snap = self.load_snapshot();
        let var_idx = snap
            .variations
            .iter()
            .position(|v| v.id == id)
            .ok_or_else(|| format!("Variation with id '{}' not found", id))?;

        snap.variations[var_idx].name = validated_name;

        self.save_snapshot(&snap, expected_revision)
    }

    pub fn delete_variation(
        &self,
        id: &str,
        expected_revision: Option<u64>,
    ) -> Result<SettingsSnapshot, String> {
        let mut snap = self.load_snapshot();
        let var_idx = snap
            .variations
            .iter()
            .position(|v| v.id == id)
            .ok_or_else(|| format!("Variation with id '{}' not found", id))?;

        let deleted = snap.variations.remove(var_idx);

        // Remove from favorites and shuffle selection
        let ref_target = LookRef::Variation { id: id.to_string() };
        snap.favorites.retain(|r| r != &ref_target);
        snap.shuffle.selected.retain(|r| r != &ref_target);

        // If committed look originated from this variation, fall back to base defaults
        if snap.committed_look.origin_variation_id.as_deref() == Some(id) {
            snap.committed_look = CommittedLook {
                scene_id: deleted.scene_id,
                appearance_version: 1,
                appearance: AppearanceParameters::default(),
                origin_variation_id: None,
            };
        }

        self.save_snapshot(&snap, expected_revision)
    }

    // --- Import / Export ---

    pub fn begin_import(&self, json_bytes: &[u8]) -> Result<ImportReviewResponse, String> {
        let payload = validate_import_json(json_bytes)?;
        let token = generate_uuid();
        self.import_tokens.insert(token.clone(), payload.clone());

        Ok(ImportReviewResponse {
            token,
            name: payload.name,
            scene_id: payload.scene_id,
            appearance: payload.appearance,
        })
    }

    pub fn commit_import(
        &self,
        token: &str,
        expected_revision: Option<u64>,
    ) -> Result<SettingsSnapshot, String> {
        let payload = self.import_tokens.consume(token)?;
        self.create_variation(
            payload.name,
            payload.scene_id,
            payload.appearance,
            expected_revision,
        )
    }

    pub fn cancel_import(&self, token: &str) {
        self.import_tokens.cancel(token);
    }

    pub fn export_variation(&self, id: &str) -> Result<String, String> {
        let snap = self.load_snapshot();
        let var = snap
            .variations
            .iter()
            .position(|v| v.id == id)
            .map(|idx| &snap.variations[idx])
            .ok_or_else(|| format!("Variation '{}' not found for export", id))?;

        let payload = InertVariationPayload {
            format: "resona-variation".to_string(),
            schema_version: 1,
            scene_id: var.scene_id,
            appearance_version: 1,
            name: var.name.clone(),
            appearance: var.appearance.clone(),
        };

        serialize_for_export(&payload)
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
        let initial = service.load_snapshot();

        let res = service.save_snapshot(&initial, Some(999));
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Revision conflict"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_corrupt_file_recovery_and_backup() {
        let temp_dir = std::env::temp_dir().join("resona_test_persist_corrupt");
        let _ = fs::remove_dir_all(&temp_dir);

        let service = PersistenceService::new(temp_dir.clone());
        let initial = service.load_snapshot();
        assert_eq!(initial.revision, 1);

        // Corrupt primary file with garbage
        fs::write(service.snapshot_path(), b"INVALID NOT JSON").unwrap();

        // Loading should detect corruption, quarantine to .corrupt, and fall back safely
        let recovered = service.load_snapshot();
        assert_eq!(recovered.schema_version, 1);
        assert!(service.corrupt_path().exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_backup_recovery() {
        let temp_dir = std::env::temp_dir().join("resona_test_persist_backup_recovery");
        let _ = fs::remove_dir_all(&temp_dir);

        let service = PersistenceService::new(temp_dir.clone());
        let initial = service.load_snapshot(); // revision 1, idle 60
        let mut snap = initial.clone();
        snap.preferences.idle_delay_sec = 300;
        let snap2 = service.save_snapshot(&snap, Some(1)).unwrap(); // revision 2, idle 300
        let _ = service.save_snapshot(&snap2, Some(2)).unwrap(); // revision 3, backup now has revision 2 with idle 300

        // Corrupt primary file
        fs::write(service.snapshot_path(), b"{ bad json !?").unwrap();

        // Load snapshot should gracefully recover from backup
        let recovered = service.load_snapshot();
        assert_eq!(recovered.preferences.idle_delay_sec, 300);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_variation_crud_lifecycle() {
        let temp_dir = std::env::temp_dir().join("resona_test_variation_crud");
        let _ = fs::remove_dir_all(&temp_dir);

        let service = PersistenceService::new(temp_dir.clone());
        let init = service.load_snapshot();

        // 1. Create variation
        let app = AppearanceParameters {
            brightness: 0.9,
            sensitivity: 1.5,
            motion_speed: 1.2,
            color_palette: "neon_violet".to_string(),
            bloom_intensity: 0.7,
        };
        let snap1 = service
            .create_variation("My Cosmic Pulse".to_string(), SceneId::PulseRing, app.clone(), Some(init.revision))
            .unwrap();
        assert_eq!(snap1.variations.len(), 1);
        let var_id = snap1.variations[0].id.clone();
        assert_eq!(snap1.committed_look.origin_variation_id, Some(var_id.clone()));

        // 2. Update variation
        let mut updated_app = app.clone();
        updated_app.brightness = 0.5;
        let snap2 = service
            .update_variation(&var_id, updated_app, Some(snap1.revision))
            .unwrap();
        assert_eq!(snap2.variations[0].appearance.brightness, 0.5);
        assert_eq!(snap2.committed_look.appearance.brightness, 0.5);

        // 3. Rename variation
        let snap3 = service
            .rename_variation(&var_id, "Renamed Look", Some(snap2.revision))
            .unwrap();
        assert_eq!(snap3.variations[0].name, "Renamed Look");

        // 4. Delete variation
        let snap4 = service
            .delete_variation(&var_id, Some(snap3.revision))
            .unwrap();
        assert_eq!(snap4.variations.len(), 0);
        assert_eq!(snap4.committed_look.origin_variation_id, None);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_import_validation_adversarial_suite() {
        let temp_dir = std::env::temp_dir().join("resona_test_import_suite");
        let _ = fs::remove_dir_all(&temp_dir);
        let service = PersistenceService::new(temp_dir.clone());

        // 1. Exceeds byte limit (65536 + 1)
        let large_payload = vec![b' '; 65_537];
        assert!(service.begin_import(&large_payload).is_err());

        // 2. Invalid format
        let invalid_fmt = br#"{"format":"fake","schemaVersion":1,"sceneId":"pulse_ring","appearanceVersion":1,"name":"Test","appearance":{"brightness":0.5,"sensitivity":1.0,"motionSpeed":1.0,"colorPalette":"neon_violet","bloomIntensity":0.5}}"#;
        assert!(service.begin_import(invalid_fmt).is_err());

        // 3. Unknown field injection (denied by strict schema)
        let unknown_field = br#"{"format":"resona-variation","schemaVersion":1,"sceneId":"pulse_ring","appearanceVersion":1,"name":"Test","appearance":{"brightness":0.5,"sensitivity":1.0,"motionSpeed":1.0,"colorPalette":"neon_violet","bloomIntensity":0.5},"maliciousCode":"alert(1)"}"#;
        assert!(service.begin_import(unknown_field).is_err());

        // 4. Non-finite parameter (out of range)
        let out_of_range = br#"{"format":"resona-variation","schemaVersion":1,"sceneId":"pulse_ring","appearanceVersion":1,"name":"Test","appearance":{"brightness":15.0,"sensitivity":1.0,"motionSpeed":1.0,"colorPalette":"neon_violet","bloomIntensity":0.5}}"#;
        assert!(service.begin_import(out_of_range).is_err());

        // 5. Valid import roundtrip
        let valid = br#"{"format":"resona-variation","schemaVersion":1,"sceneId":"pulse_ring","appearanceVersion":1,"name":"Valid Look","appearance":{"brightness":0.8,"sensitivity":1.2,"motionSpeed":1.0,"colorPalette":"neon_violet","bloomIntensity":0.6}}"#;
        let review = service.begin_import(valid).unwrap();
        assert_eq!(review.name, "Valid Look");

        let initial_rev = service.load_snapshot().revision;
        let committed = service.commit_import(&review.token, Some(initial_rev)).unwrap();
        assert_eq!(committed.variations.len(), 1);
        assert_eq!(committed.variations[0].name, "Valid Look");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
