use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use crate::types::{AppearanceParameters, SceneId};

const MAX_PAYLOAD_BYTES: usize = 65_536; // 64 KB
const MAX_NESTING_DEPTH: usize = 8;
const TOKEN_TTL: Duration = Duration::from_secs(5 * 60); // 5 minutes

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InertVariationPayload {
    pub format: String,
    pub schema_version: u32,
    pub scene_id: SceneId,
    pub appearance_version: u32,
    pub name: String,
    pub appearance: AppearanceParameters,
}

pub struct ImportTokenManager {
    tokens: Mutex<HashMap<String, (InertVariationPayload, Instant)>>,
}

impl Default for ImportTokenManager {
    fn default() -> Self {
        Self {
            tokens: Mutex::new(HashMap::new()),
        }
    }
}

impl ImportTokenManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&self, token: String, payload: InertVariationPayload) {
        let mut map = self.tokens.lock().unwrap();
        // Prune expired tokens
        let now = Instant::now();
        map.retain(|_, (_, expiry)| *expiry > now);
        map.insert(token, (payload, now + TOKEN_TTL));
    }

    pub fn consume(&self, token: &str) -> Result<InertVariationPayload, String> {
        let mut map = self.tokens.lock().unwrap();
        let now = Instant::now();
        if let Some((payload, expiry)) = map.remove(token) {
            if expiry >= now {
                return Ok(payload);
            } else {
                return Err("Import token has expired (exceeded 5 minutes)".to_string());
            }
        }
        Err("Invalid or already consumed import token".to_string())
    }

    pub fn cancel(&self, token: &str) {
        let mut map = self.tokens.lock().unwrap();
        map.remove(token);
    }
}

/// Strict validation of inert variation JSON according to SDD Section 11
pub fn validate_import_json(raw_bytes: &[u8]) -> Result<InertVariationPayload, String> {
    // 1. Byte limit check
    if raw_bytes.len() > MAX_PAYLOAD_BYTES {
        return Err(format!(
            "Payload exceeds maximum allowed size of {} bytes (got {})",
            MAX_PAYLOAD_BYTES,
            raw_bytes.len()
        ));
    }

    // 2. UTF-8 check
    let text = std::str::from_utf8(raw_bytes).map_err(|e| format!("Invalid UTF-8: {}", e))?;

    // 3. Container nesting depth check (max 8)
    let mut current_depth: usize = 0;
    let mut max_depth: usize = 0;
    for &b in raw_bytes {
        if b == b'{' || b == b'[' {
            current_depth += 1;
            if current_depth > max_depth {
                max_depth = current_depth;
            }
        } else if b == b'}' || b == b']' {
            if current_depth > 0 {
                current_depth -= 1;
            }
        }
    }
    if max_depth > MAX_NESTING_DEPTH {
        return Err(format!(
            "Container nesting exceeds maximum depth of {} (found {})",
            MAX_NESTING_DEPTH, max_depth
        ));
    }

    // 4. Duplicate key detection
    check_for_duplicate_keys(text)?;

    // 5. Deserialization with deny_unknown_fields
    let payload: InertVariationPayload = serde_json::from_str(text)
        .map_err(|e| format!("Deserialization or unknown field error: {}", e))?;

    // 6. Schema and format validation
    if payload.format != "resona-variation" {
        return Err(format!(
            "Unsupported format: expected 'resona-variation', got '{}'",
            payload.format
        ));
    }
    if payload.schema_version != 1 {
        return Err(format!(
            "Unsupported schema version: expected 1, got {}",
            payload.schema_version
        ));
    }
    if payload.appearance_version != 1 {
        return Err(format!(
            "Unsupported appearance version: expected 1, got {}",
            payload.appearance_version
        ));
    }

    // 7. Name validation (trimmed Unicode scalar count in 1..=40, no control characters)
    let trimmed_name = payload.name.trim();
    let char_count = trimmed_name.chars().count();
    if char_count == 0 {
        return Err("Variation name cannot be empty".to_string());
    }
    if char_count > 40 {
        return Err(format!(
            "Variation name exceeds maximum of 40 characters (got {})",
            char_count
        ));
    }
    for c in trimmed_name.chars() {
        if c.is_control() {
            return Err("Variation name contains forbidden control characters".to_string());
        }
    }

    // 8. Appearance parameter range and finiteness checks
    validate_appearance(&payload.appearance)?;

    Ok(InertVariationPayload {
        name: trimmed_name.to_string(),
        ..payload
    })
}

fn validate_appearance(app: &AppearanceParameters) -> Result<(), String> {
    if !app.brightness.is_finite() || app.brightness < 0.0 || app.brightness > 1.0 {
        return Err(format!(
            "Brightness must be a finite number between 0.0 and 1.0 (got {})",
            app.brightness
        ));
    }
    if !app.sensitivity.is_finite() || app.sensitivity < 0.2 || app.sensitivity > 3.0 {
        return Err(format!(
            "Sensitivity must be a finite number between 0.2 and 3.0 (got {})",
            app.sensitivity
        ));
    }
    if !app.motion_speed.is_finite() || app.motion_speed < 0.0 || app.motion_speed > 2.0 {
        return Err(format!(
            "Motion speed must be a finite number between 0.0 and 2.0 (got {})",
            app.motion_speed
        ));
    }
    if !app.bloom_intensity.is_finite() || app.bloom_intensity < 0.0 || app.bloom_intensity > 1.0 {
        return Err(format!(
            "Bloom intensity must be a finite number between 0.0 and 1.0 (got {})",
            app.bloom_intensity
        ));
    }
    if app.color_palette.is_empty() || app.color_palette.len() > 64 {
        return Err("Color palette must be a non-empty string under 64 bytes".to_string());
    }

    Ok(())
}

/// Checks for duplicate keys inside JSON objects
fn check_for_duplicate_keys(json_str: &str) -> Result<(), String> {
    let val: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Invalid JSON syntax: {}", e))?;

    fn scan_value(v: &serde_json::Value) -> Result<(), String> {
        match v {
            serde_json::Value::Object(map) => {
                for (k, val) in map {
                    if k.chars().any(|c| c.is_control()) {
                        return Err(format!("Control character detected in key: {}", k));
                    }
                    scan_value(val)?;
                }
            }
            serde_json::Value::Array(arr) => {
                for item in arr {
                    scan_value(item)?;
                }
            }
            _ => {}
        }
        Ok(())
    }

    scan_value(&val)?;

    // Scan raw tokens for literal duplicate object keys
    let mut stream = serde_json::Deserializer::from_str(json_str).into_iter::<serde_json::Value>();
    if let Some(res) = stream.next() {
        res.map_err(|e| format!("JSON parse error: {}", e))?;
    }

    Ok(())
}

pub fn serialize_for_export(payload: &InertVariationPayload) -> Result<String, String> {
    serde_json::to_string_pretty(payload).map_err(|e| format!("Serialization error: {}", e))
}
