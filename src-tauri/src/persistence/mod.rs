use crate::types::AppearanceParameters;
use std::fs;
use std::path::PathBuf;

pub struct PersistenceService {
    config_dir: PathBuf,
}

impl PersistenceService {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { config_dir }
    }

    pub fn load_parameters(&self) -> AppearanceParameters {
        let config_file = self.config_dir.join("settings.json");
        if let Ok(content) = fs::read_to_string(&config_file) {
            if let Ok(params) = serde_json::from_str(&content) {
                return params;
            }
        }
        AppearanceParameters::default()
    }

    pub fn save_parameters(&self, params: &AppearanceParameters) -> Result<(), String> {
        let config_file = self.config_dir.join("settings.json");
        let json = serde_json::to_string_pretty(params).map_err(|e| e.to_string())?;
        fs::write(config_file, json).map_err(|e| e.to_string())
    }
}
