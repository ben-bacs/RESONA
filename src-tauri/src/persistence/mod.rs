use crate::types::{AppearanceParameters, UserPreferences};
use std::fs;
use std::path::PathBuf;

pub struct PersistenceService {
    config_dir: PathBuf,
}

impl PersistenceService {
    pub fn new(config_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&config_dir);
        Self { config_dir }
    }

    pub fn load_preferences(&self) -> UserPreferences {
        let config_file = self.config_dir.join("preferences.json");
        if let Ok(content) = fs::read_to_string(&config_file) {
            if let Ok(prefs) = serde_json::from_str(&content) {
                return prefs;
            }
        }
        UserPreferences::default()
    }

    pub fn save_preferences(&self, prefs: &UserPreferences) -> Result<(), String> {
        let config_file = self.config_dir.join("preferences.json");
        let json = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;
        fs::write(config_file, json).map_err(|e| e.to_string())
    }

    pub fn load_parameters(&self) -> AppearanceParameters {
        let config_file = self.config_dir.join("parameters.json");
        if let Ok(content) = fs::read_to_string(&config_file) {
            if let Ok(params) = serde_json::from_str(&content) {
                return params;
            }
        }
        AppearanceParameters::default()
    }

    pub fn save_parameters(&self, params: &AppearanceParameters) -> Result<(), String> {
        let config_file = self.config_dir.join("parameters.json");
        let json = serde_json::to_string_pretty(params).map_err(|e| e.to_string())?;
        fs::write(config_file, json).map_err(|e| e.to_string())
    }
}
