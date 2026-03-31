use crate::artifact_sync;
use crate::state::{AppState, AppStatus};
use crate::sync;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::State;

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))
}

#[derive(Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: LoginUser,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginUser {
    pub org_id: String,
}

#[tauri::command]
pub async fn login(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] apiUrl: String,
    email: String,
    password: String,
) -> Result<(), String> {
    let client = http_client()?;
    let resp = client
        .post(format!("{}/api/auth/login", apiUrl))
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = body["error"].as_str().unwrap_or("Invalid credentials");
        return Err(msg.to_string());
    }

    let data: LoginResponse = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    {
        let mut config = state.config.lock().unwrap();
        config.api_url = apiUrl;
        config.auth_token = Some(data.token);
        config.email = Some(email);
        config.org_id = Some(data.user.org_id);
        config.device_id = None;
    }
    state.save_config();

    // Detect installed tools
    let tools = sync::detect_installed_tools();
    *state.installed_tools.lock().unwrap() = tools;

    Ok(())
}

#[tauri::command]
pub fn logout(state: State<'_, AppState>) -> Result<(), String> {
    {
        let mut config = state.config.lock().unwrap();
        config.auth_token = None;
        config.email = None;
        config.org_id = None;
        config.device_id = None;
    }
    state.save_config();
    *state.sync_status.lock().unwrap() = "idle".to_string();
    *state.installed_tools.lock().unwrap() = Vec::new();
    *state.synced_configs.lock().unwrap() = 0;
    *state.last_sync.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> AppStatus {
    let config = state.config.lock().unwrap();
    AppStatus {
        logged_in: config.auth_token.is_some(),
        email: config.email.clone(),
        api_url: config.api_url.clone(),
        sync_interval: config.sync_interval,
        last_sync: state.last_sync.lock().unwrap().clone(),
        sync_status: state.sync_status.lock().unwrap().clone(),
        installed_tools: state.installed_tools.lock().unwrap().clone(),
        synced_configs: *state.synced_configs.lock().unwrap(),
    }
}

#[tauri::command]
pub async fn sync_now(state: State<'_, AppState>) -> Result<(), String> {
    let (api_url, token, existing_device_id) = {
        let config = state.config.lock().unwrap();
        let token = config.auth_token.clone().ok_or("Not logged in")?;
        (config.api_url.clone(), token, config.device_id.clone())
    };

    *state.sync_status.lock().unwrap() = "syncing".to_string();

    // Detect tools
    let tools = sync::detect_installed_tools();
    *state.installed_tools.lock().unwrap() = tools.clone();

    match artifact_sync::sync_device(&api_url, &token, existing_device_id).await {
        Ok(result) => {
            {
                let mut config = state.config.lock().unwrap();
                config.device_id = Some(result.device_id);
            }
            state.save_config();
            *state.synced_configs.lock().unwrap() = result.applied_count;
            *state.sync_status.lock().unwrap() = "synced".to_string();
            *state.last_sync.lock().unwrap() = Some(now_millis());
        }
        Err(e) => {
            *state.sync_status.lock().unwrap() = "error".to_string();
            return Err(e);
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> (String, u64) {
    let config = state.config.lock().unwrap();
    (config.api_url.clone(), config.sync_interval)
}

#[tauri::command]
pub fn save_settings(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] apiUrl: String,
    #[allow(non_snake_case)] syncInterval: u64,
) -> Result<(), String> {
    {
        let mut config = state.config.lock().unwrap();
        config.api_url = apiUrl;
        config.sync_interval = syncInterval;
    }
    state.save_config();
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    pub id: String,
    pub title: String,
    pub config_type: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
}

#[tauri::command]
pub fn detect_local_configs() -> Result<Vec<sync::LocalConfig>, String> {
    Ok(sync::detect_local_configs())
}

#[tauri::command]
pub fn scan_tools() -> Result<Vec<sync::ToolScan>, String> {
    Ok(sync::scan_tools_detailed())
}

#[tauri::command]
pub async fn submit_suggestion(
    state: State<'_, AppState>,
    #[allow(non_snake_case)] profileId: String,
    #[allow(non_snake_case)] configType: String,
    title: String,
    description: String,
    content: String,
    capture: Option<serde_json::Value>,
) -> Result<(), String> {
    let (api_url, token, org_id, device_id) = {
        let config = state.config.lock().unwrap();
        let token = config.auth_token.clone().ok_or("Not logged in")?;
        let org_id = config.org_id.clone().ok_or("No org ID")?;
        (
            config.api_url.clone(),
            token,
            org_id,
            config.device_id.clone(),
        )
    };

    let client = http_client()?;
    let resp = client
        .post(format!("{}/api/orgs/{}/submissions", api_url, org_id))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "title": title,
            "description": description,
            "sourceDeviceId": device_id,
            "capture": capture.unwrap_or_else(|| build_submission_capture(&profileId, &configType, &content, &description, &title)),
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = body["error"].as_str().unwrap_or("Failed to submit suggestion");
        return Err(msg.to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn get_my_suggestions(state: State<'_, AppState>) -> Result<Vec<Suggestion>, String> {
    let (api_url, token, org_id) = {
        let config = state.config.lock().unwrap();
        let token = config.auth_token.clone().ok_or("Not logged in")?;
        let org_id = config.org_id.clone().ok_or("No org ID")?;
        (config.api_url.clone(), token, org_id)
    };

    let client = http_client()?;
    let resp = client
        .get(format!("{}/api/orgs/{}/submissions", api_url, org_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("API error: {}", resp.status()));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    let submissions = body
        .get("submissions")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();

    Ok(submissions
        .into_iter()
        .map(|submission| Suggestion {
            id: submission.get("id").and_then(|value| value.as_str()).unwrap_or_default().to_string(),
            title: submission.get("title").and_then(|value| value.as_str()).unwrap_or("Untitled submission").to_string(),
            config_type: submission.get("artifactKind").and_then(|value| value.as_str()).unwrap_or("unknown").to_string(),
            status: submission.get("status").and_then(|value| value.as_str()).unwrap_or("pending").to_string(),
            created_at: submission.get("createdAt").and_then(|value| value.as_str()).unwrap_or_default().to_string(),
        })
        .collect())
}

#[tauri::command]
pub async fn get_profiles(state: State<'_, AppState>) -> Result<Vec<Profile>, String> {
    let (api_url, token, org_id) = {
        let config = state.config.lock().unwrap();
        let token = config.auth_token.clone().ok_or("Not logged in")?;
        let org_id = config.org_id.clone().ok_or("No org ID")?;
        (config.api_url.clone(), token, org_id)
    };

    let client = http_client()?;
    let resp = client
        .get(format!("{}/api/orgs/{}/profiles", api_url, org_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("API error: {}", resp.status()));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    let profiles: Vec<Profile> = serde_json::from_value(
        body.get("profiles").cloned().unwrap_or(serde_json::json!([]))
    ).map_err(|e| format!("Parse profiles error: {}", e))?;

    Ok(profiles)
}

#[tauri::command]
pub async fn upload_snapshot(
    state: State<'_, AppState>,
    tools: Vec<sync::ToolScan>,
) -> Result<(), String> {
    let (api_url, token, existing_device_id) = {
        let config = state.config.lock().unwrap();
        let token = config.auth_token.clone().ok_or("Not logged in")?;
        (config.api_url.clone(), token, config.device_id.clone())
    };

    let device_id = artifact_sync::upload_inventory_snapshot(
        &api_url,
        &token,
        existing_device_id,
        &tools,
    )
    .await?;

    {
        let mut config = state.config.lock().unwrap();
        config.device_id = Some(device_id);
    }
    state.save_config();

    println!("[LFC] Snapshot uploaded to server");
    Ok(())
}

fn build_submission_capture(
    profile_id: &str,
    config_type: &str,
    content: &str,
    description: &str,
    title: &str,
) -> serde_json::Value {
    let source_tool = description
        .strip_prefix("From ")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "claude-code".to_string());

    match config_type {
        "mcp" => {
            let parsed = serde_json::from_str::<serde_json::Value>(content).ok();
            let server = parsed
                .as_ref()
                .and_then(|value| value.get("servers"))
                .and_then(|value| value.as_array())
                .and_then(|servers| servers.first());
            let name = server
                .and_then(|value| value.get("name"))
                .and_then(|value| value.as_str())
                .unwrap_or(title);
            let command = server
                .and_then(|value| value.get("command"))
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            let args = server
                .and_then(|value| value.get("args"))
                .and_then(|value| value.as_array())
                .map(|values| {
                    values
                        .iter()
                        .filter_map(|value| value.as_str().map(|value| value.to_string()))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let env_keys = server
                .and_then(|value| value.get("env"))
                .and_then(|value| value.as_object())
                .map(|env| env.keys().cloned().collect::<Vec<_>>())
                .unwrap_or_default();

            serde_json::json!({
                "kind": "mcp",
                "name": name,
                "tool": source_tool,
                "serverName": name,
                "command": command,
                "args": args,
                "envKeys": env_keys,
                "metadata": {
                    "profileId": profile_id,
                }
            })
        }
        "skills" | "agents" | "rules" | "instructions" => {
            let parsed = serde_json::from_str::<serde_json::Value>(content).ok();
            let kind = match config_type {
                "skills" => "skill",
                "agents" => "agent",
                "rules" => "rule",
                _ => "instructions",
            };
            let name = parsed
                .as_ref()
                .and_then(|value| value.get("name"))
                .and_then(|value| value.as_str())
                .unwrap_or(title);
            let normalized_content = parsed
                .as_ref()
                .and_then(|value| value.get("content"))
                .and_then(|value| value.as_str())
                .unwrap_or(content);

            serde_json::json!({
                "kind": kind,
                "name": name,
                "tool": source_tool,
                "content": normalized_content,
                "metadata": {
                    "profileId": profile_id,
                }
            })
        }
        _ => serde_json::json!({
            "kind": "skill",
            "name": title,
            "tool": source_tool,
            "content": content,
            "metadata": {
                "profileId": profile_id,
            }
        }),
    }
}

fn now_millis() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    ms.to_string()
}
