use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(alias = "api_url")]
    pub api_url: String,
    #[serde(alias = "auth_token")]
    pub auth_token: Option<String>,
    pub email: Option<String>,
    #[serde(alias = "org_id")]
    pub org_id: Option<String>,
    #[serde(alias = "device_id")]
    pub device_id: Option<String>,
    #[serde(alias = "sync_interval")]
    pub sync_interval: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_url: "https://api.lfc.dev".to_string(),
            auth_token: None,
            email: None,
            org_id: None,
            device_id: None,
            sync_interval: 7200,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    pub logged_in: bool,
    pub email: Option<String>,
    pub api_url: String,
    pub sync_interval: u64,
    pub last_sync: Option<String>,
    pub sync_status: String,
    pub installed_tools: Vec<String>,
    pub synced_configs: u32,
}

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub last_sync: Mutex<Option<String>>,
    pub sync_status: Mutex<String>,
    pub installed_tools: Mutex<Vec<String>>,
    pub synced_configs: Mutex<u32>,
}

impl AppState {
    pub fn new() -> Self {
        let config = Self::load_config().unwrap_or_default();
        Self {
            config: Mutex::new(config),
            last_sync: Mutex::new(None),
            sync_status: Mutex::new("idle".to_string()),
            installed_tools: Mutex::new(Vec::new()),
            synced_configs: Mutex::new(0),
        }
    }

    fn config_path() -> PathBuf {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let dir = home.join(".lfc");
        fs::create_dir_all(&dir).ok();
        dir.join("config.json")
    }

    fn load_config() -> Option<AppConfig> {
        let path = Self::config_path();
        let data = fs::read_to_string(&path).ok()?;
        match serde_json::from_str(&data) {
            Ok(config) => Some(config),
            Err(e) => {
                eprintln!("[LFC] Failed to parse config at {}: {}. Using defaults.", path.display(), e);
                // Delete corrupted/incompatible config so it gets rewritten on next save
                fs::remove_file(&path).ok();
                None
            }
        }
    }

    pub fn save_config(&self) {
        let config = self.config.lock().unwrap();
        let path = Self::config_path();
        if let Ok(json) = serde_json::to_string_pretty(&*config) {
            fs::write(path, json).ok();
        }
    }
}
