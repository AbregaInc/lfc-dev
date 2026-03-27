use crate::sync;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DeviceRegistrationResponse {
    device: RegisteredDevice,
    feature_flags: HashMap<String, bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RegisteredDevice {
    id: String,
    org_id: String,
    user_id: String,
    name: String,
    platform: String,
    arch: String,
    client_kind: String,
    client_version: String,
    status: String,
    last_seen_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DeviceSyncResponse {
    device: RegisteredDevice,
    assignments: Vec<SyncAssignment>,
    removals: Vec<String>,
    server_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SyncAssignment {
    assignment_id: String,
    profile_id: String,
    profile_name: String,
    desired_state: String,
    rollout_strategy: String,
    artifact: AssignmentArtifact,
    release: AssignmentRelease,
    resolved_secrets: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AssignmentArtifact {
    id: String,
    slug: String,
    name: String,
    kind: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AssignmentRelease {
    id: String,
    artifact_id: String,
    version: String,
    status: String,
    reliability_tier: String,
    manifest: ArtifactManifest,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ArtifactManifest {
    kind: String,
    reliability_tier: String,
    source: ManifestSource,
    runtime: ManifestRuntime,
    install: ManifestInstall,
    launch: Option<ManifestLaunch>,
    verify: Option<ManifestVerify>,
    payload: Option<ManifestPayload>,
    compatibility: ManifestCompatibility,
    bindings: Vec<ManifestBinding>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestSource {
    r#type: String,
    r#ref: String,
    version: Option<String>,
    digest: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestRuntime {
    kind: String,
    version: Option<String>,
    provision_mode: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestInstall {
    strategy: String,
    managed_root: String,
    wrapper_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestLaunch {
    command: String,
    args: Vec<String>,
    env: Vec<ManifestEnv>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestEnv {
    name: String,
    required: bool,
    secret_ref: Option<String>,
    default_value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestVerify {
    r#type: String,
    command: Option<String>,
    args: Option<Vec<String>>,
    url: Option<String>,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestPayload {
    files: Option<Vec<ManifestFile>>,
    download_url: Option<String>,
    checksum: Option<String>,
    image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestFile {
    path: String,
    content: String,
    executable: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestCompatibility {
    os: Vec<String>,
    arch: Vec<String>,
    tools: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestBinding {
    tool: String,
    binding_type: String,
    target_path: Option<String>,
    config_template: Option<String>,
    config_json: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LocalState {
    artifact_states: HashMap<String, LocalArtifactState>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LocalArtifactState {
    artifact_release_id: String,
    desired_state: String,
    actual_state: String,
    activation_state: Option<String>,
    install_root: Option<String>,
    wrapper_path: Option<String>,
    previous_release_id: Option<String>,
    last_error_code: Option<String>,
    last_error_detail: Option<String>,
    inventory_json: Option<serde_json::Value>,
    last_verified_at: Option<String>,
    last_transition_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RegisterDeviceRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    device_id: Option<String>,
    name: String,
    platform: String,
    arch: String,
    client_kind: String,
    client_version: String,
    detected_tools: Vec<DetectedToolInput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DetectedToolInput {
    tool: String,
    installed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncRequest {
    detected_tools: Vec<DetectedToolInput>,
    states: Vec<LocalArtifactState>,
    inventory: serde_json::Value,
}

#[derive(Debug)]
pub struct SyncRunResult {
    pub device_id: String,
    pub applied_count: u32,
}

#[derive(Debug)]
struct InstallResult {
    install_root: String,
    wrapper_path: Option<String>,
}

fn config_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(".lfc")
}

fn artifacts_dir() -> PathBuf {
    config_dir().join("artifacts")
}

fn bin_dir() -> PathBuf {
    config_dir().join("bin")
}

fn local_state_path() -> PathBuf {
    config_dir().join("tray-artifact-state.json")
}

fn load_local_state() -> LocalState {
    let path = local_state_path();
    fs::read_to_string(path)
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_else(|| LocalState {
            artifact_states: HashMap::new(),
        })
}

fn save_local_state(state: &LocalState) -> Result<(), String> {
    fs::create_dir_all(config_dir()).map_err(|e| format!("State dir error: {}", e))?;
    let path = local_state_path();
    let json = serde_json::to_string_pretty(state).map_err(|e| format!("State serialize error: {}", e))?;
    fs::write(path, json).map_err(|e| format!("State write error: {}", e))
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| format!("Mkdir error: {}", e))
}

fn artifact_root(release_id: &str) -> PathBuf {
    artifacts_dir().join(release_id)
}

fn now_iso() -> String {
    chrono_like_now()
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let dt = time::OffsetDateTime::from_unix_timestamp(secs as i64).unwrap_or(time::OffsetDateTime::UNIX_EPOCH);
    dt.format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn shell_escape(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn write_file(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    fs::write(path, content).map_err(|e| format!("Write error: {}", e))
}

fn write_executable(path: &Path, content: &str) -> Result<(), String> {
    write_file(path, content)?;
    #[cfg(unix)]
    {
        let mut perms = fs::metadata(path)
            .map_err(|e| format!("Metadata error: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(path, perms).map_err(|e| format!("chmod error: {}", e))?;
    }
    Ok(())
}

fn run_command(command: &str, args: &[&str], cwd: Option<&Path>) -> Result<String, String> {
    let mut cmd = Command::new(command);
    cmd.args(args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    let output = cmd.output().map_err(|e| format!("{} launch error: {}", command, e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Err(if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("{} failed", command)
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn find_python_command() -> Option<String> {
    for candidate in ["python3", "python"] {
        if run_command(candidate, &["--version"], None).is_ok() {
            return Some(candidate.to_string());
        }
    }
    None
}

fn tool_inputs(scans: &[sync::ToolScan]) -> Vec<DetectedToolInput> {
    scans.iter()
        .map(|scan| DetectedToolInput {
            tool: scan.id.clone(),
            installed: scan.installed,
        })
        .collect()
}

fn inventory_value(scans: &[sync::ToolScan]) -> serde_json::Value {
    serde_json::to_value(scans).unwrap_or(serde_json::json!({ "tools": [] }))
}

fn resolve_binding_content(assignment: &SyncAssignment) -> String {
    let files = assignment
        .release
        .manifest
        .payload
        .as_ref()
        .and_then(|payload| payload.files.clone())
        .unwrap_or_default();
    if files.is_empty() {
        return String::new();
    }
    files.into_iter()
        .find(|file| file.path.to_lowercase().contains("skill"))
        .or_else(|| {
            assignment
                .release
                .manifest
                .payload
                .as_ref()
                .and_then(|payload| payload.files.clone())
                .and_then(|mut list| list.drain(..).next())
        })
        .map(|file| file.content)
        .unwrap_or_default()
}

fn render_instruction_block(assignment: &SyncAssignment) -> String {
    let content = resolve_binding_content(assignment);
    if content.trim().is_empty() {
        format!("# {}\n", assignment.artifact.name)
    } else {
        format!("# {}\n{}", assignment.artifact.name, content.trim())
    }
}

fn write_env_file(root: &Path, assignment: &SyncAssignment) -> Result<PathBuf, String> {
    let env_dir = root.join("env");
    ensure_dir(&env_dir)?;
    let mut lines = Vec::new();
    if let Some(launch) = &assignment.release.manifest.launch {
        for field in &launch.env {
            let value = assignment
                .resolved_secrets
                .get(&field.name)
                .cloned()
                .or_else(|| field.default_value.clone());
            if let Some(value) = value {
                lines.push(format!("export {}={}", field.name, shell_escape(&value)));
            }
        }
    }
    let env_path = env_dir.join("env.sh");
    write_file(&env_path, &format!("{}\n", lines.join("\n")))?;
    #[cfg(unix)]
    {
        let mut perms = fs::metadata(&env_path)
            .map_err(|e| format!("Metadata error: {}", e))?
            .permissions();
        perms.set_mode(0o600);
        fs::set_permissions(&env_path, perms).map_err(|e| format!("chmod error: {}", e))?;
    }
    Ok(env_path)
}

fn install_copy_files(assignment: &SyncAssignment) -> Result<InstallResult, String> {
    let root = artifact_root(&assignment.release.id);
    ensure_dir(&root.join("payload"))?;
    if let Some(payload) = &assignment.release.manifest.payload {
        if let Some(files) = &payload.files {
            for file in files {
                let target = root.join("payload").join(&file.path);
                write_file(&target, &file.content)?;
                if file.executable.unwrap_or(false) {
                    #[cfg(unix)]
                    {
                        let mut perms = fs::metadata(&target)
                            .map_err(|e| format!("Metadata error: {}", e))?
                            .permissions();
                        perms.set_mode(0o755);
                        fs::set_permissions(&target, perms).map_err(|e| format!("chmod error: {}", e))?;
                    }
                }
            }
        }
    }
    Ok(InstallResult {
        install_root: root.to_string_lossy().to_string(),
        wrapper_path: None,
    })
}

fn install_npm_package(assignment: &SyncAssignment) -> Result<InstallResult, String> {
    let manifest = &assignment.release.manifest;
    let launch = manifest.launch.as_ref().ok_or("npm_package installer requires launch config")?;
    let version = manifest.source.version.clone().ok_or("npm_package installer requires source.version")?;
    let root = artifact_root(&assignment.release.id);
    let wrapper_path = bin_dir().join(
        manifest
            .install
            .wrapper_name
            .clone()
            .unwrap_or_else(|| assignment.artifact.slug.clone()),
    );
    ensure_dir(&root)?;
    ensure_dir(&bin_dir())?;
    write_file(
        &root.join("package.json"),
        &serde_json::json!({ "private": true, "name": format!("lfc-{}", assignment.release.id) }).to_string(),
    )?;
    run_command(
        "npm",
        &[
            "install",
            "--silent",
            "--no-package-lock",
            "--prefix",
            root.to_string_lossy().as_ref(),
            &format!("{}@{}", manifest.source.r#ref, version),
        ],
        Some(&root),
    )?;
    let env_path = write_env_file(&root, assignment)?;
    write_executable(
        &wrapper_path,
        &format!(
            "#!/bin/sh\nset -e\n. {}\nexec {} \"$@\"\n",
            shell_escape(&env_path.to_string_lossy()),
            shell_escape(
                &root.join("node_modules")
                    .join(".bin")
                    .join(&launch.command)
                    .to_string_lossy()
            )
        ),
    )?;
    Ok(InstallResult {
        install_root: root.to_string_lossy().to_string(),
        wrapper_path: Some(wrapper_path.to_string_lossy().to_string()),
    })
}

fn install_python_package(assignment: &SyncAssignment) -> Result<InstallResult, String> {
    let manifest = &assignment.release.manifest;
    let launch = manifest.launch.as_ref().ok_or("python_package installer requires launch config")?;
    let version = manifest.source.version.clone().ok_or("python_package installer requires source.version")?;
    let python = find_python_command().ok_or("python3/python not found")?;
    let root = artifact_root(&assignment.release.id);
    let venv = root.join("venv");
    let wrapper_path = bin_dir().join(
        manifest
            .install
            .wrapper_name
            .clone()
            .unwrap_or_else(|| assignment.artifact.slug.clone()),
    );
    ensure_dir(&root)?;
    ensure_dir(&bin_dir())?;
    run_command(&python, &["-m", "venv", venv.to_string_lossy().as_ref()], Some(&root))?;
    run_command(
        venv.join("bin").join("pip").to_string_lossy().as_ref(),
        &["install", &format!("{}=={}", manifest.source.r#ref, version)],
        Some(&root),
    )?;
    let env_path = write_env_file(&root, assignment)?;
    write_executable(
        &wrapper_path,
        &format!(
            "#!/bin/sh\nset -e\n. {}\nexec {} \"$@\"\n",
            shell_escape(&env_path.to_string_lossy()),
            shell_escape(&venv.join("bin").join(&launch.command).to_string_lossy())
        ),
    )?;
    Ok(InstallResult {
        install_root: root.to_string_lossy().to_string(),
        wrapper_path: Some(wrapper_path.to_string_lossy().to_string()),
    })
}

async fn install_binary_download(assignment: &SyncAssignment) -> Result<InstallResult, String> {
    let manifest = &assignment.release.manifest;
    let launch = manifest.launch.as_ref().ok_or("download_binary installer requires launch config")?;
    let url = manifest
        .payload
        .as_ref()
        .and_then(|payload| payload.download_url.clone())
        .ok_or("download_binary installer requires payload.downloadUrl")?;
    let root = artifact_root(&assignment.release.id);
    let binary_path = root.join("bin").join(&launch.command);
    let wrapper_path = bin_dir().join(
        manifest
            .install
            .wrapper_name
            .clone()
            .unwrap_or_else(|| assignment.artifact.slug.clone()),
    );
    ensure_dir(binary_path.parent().unwrap_or(&root))?;
    ensure_dir(&bin_dir())?;
    let client = reqwest::Client::new();
    let bytes = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Download error: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("Download read error: {}", e))?;
    fs::write(&binary_path, bytes).map_err(|e| format!("Binary write error: {}", e))?;
    #[cfg(unix)]
    {
        let mut perms = fs::metadata(&binary_path)
            .map_err(|e| format!("Metadata error: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&binary_path, perms).map_err(|e| format!("chmod error: {}", e))?;
    }
    let env_path = write_env_file(&root, assignment)?;
    write_executable(
        &wrapper_path,
        &format!(
            "#!/bin/sh\nset -e\n. {}\nexec {} \"$@\"\n",
            shell_escape(&env_path.to_string_lossy()),
            shell_escape(&binary_path.to_string_lossy())
        ),
    )?;
    Ok(InstallResult {
        install_root: root.to_string_lossy().to_string(),
        wrapper_path: Some(wrapper_path.to_string_lossy().to_string()),
    })
}

fn install_docker_image(assignment: &SyncAssignment) -> Result<InstallResult, String> {
    let manifest = &assignment.release.manifest;
    let launch = manifest.launch.as_ref().ok_or("pull_image installer requires launch config")?;
    let image = manifest
        .payload
        .as_ref()
        .and_then(|payload| payload.image.clone())
        .unwrap_or_else(|| manifest.source.r#ref.clone());
    let root = artifact_root(&assignment.release.id);
    let wrapper_path = bin_dir().join(
        manifest
            .install
            .wrapper_name
            .clone()
            .unwrap_or_else(|| assignment.artifact.slug.clone()),
    );
    ensure_dir(&root)?;
    ensure_dir(&bin_dir())?;
    run_command("docker", &["pull", &image], Some(&root))?;
    let env_path = write_env_file(&root, assignment)?;
    write_executable(
        &wrapper_path,
        &format!(
            "#!/bin/sh\nset -e\n. {}\nexec docker run --rm -i --entrypoint {} {} \"$@\"\n",
            shell_escape(&env_path.to_string_lossy()),
            shell_escape(&launch.command),
            shell_escape(&image)
        ),
    )?;
    Ok(InstallResult {
        install_root: root.to_string_lossy().to_string(),
        wrapper_path: Some(wrapper_path.to_string_lossy().to_string()),
    })
}

fn install_write_config_only(assignment: &SyncAssignment) -> Result<InstallResult, String> {
    Ok(InstallResult {
        install_root: artifact_root(&assignment.release.id).to_string_lossy().to_string(),
        wrapper_path: assignment
            .release
            .manifest
            .launch
            .as_ref()
            .map(|launch| launch.command.clone()),
    })
}

async fn ensure_assignment_installed(assignment: &SyncAssignment) -> Result<InstallResult, String> {
    match assignment.release.manifest.install.strategy.as_str() {
        "copy_files" => install_copy_files(assignment),
        "npm_package" => install_npm_package(assignment),
        "python_package" => install_python_package(assignment),
        "download_binary" => install_binary_download(assignment).await,
        "pull_image" => install_docker_image(assignment),
        "write_config_only" => install_write_config_only(assignment),
        other => Err(format!("Unsupported install strategy: {}", other)),
    }
}

fn verify_assignment(assignment: &SyncAssignment, wrapper_path: Option<&str>) -> (String, Option<String>, Option<String>) {
    let verify = match &assignment.release.manifest.verify {
        Some(verify) => verify,
        None => {
            return (
                if assignment.release.reliability_tier == "unreliable" {
                    "config_applied_unverified".to_string()
                } else {
                    "active".to_string()
                },
                None,
                Some(now_iso()),
            )
        }
    };

    if verify.r#type == "none" {
        return (
            if assignment.release.reliability_tier == "unreliable" {
                "config_applied_unverified".to_string()
            } else {
                "active".to_string()
            },
            None,
            Some(now_iso()),
        );
    }

    if verify.r#type == "exec" {
        let command = wrapper_path
            .map(|value| value.to_string())
            .or_else(|| verify.command.clone())
            .or_else(|| assignment.release.manifest.launch.as_ref().map(|launch| launch.command.clone()));
        if let Some(command) = command {
            let args: Vec<String> = verify.args.clone().unwrap_or_default();
            let borrowed: Vec<&str> = args.iter().map(|arg| arg.as_str()).collect();
            match run_command(&command, &borrowed, None) {
                Ok(_) => ("active".to_string(), None, Some(now_iso())),
                Err(err) => ("failed".to_string(), Some(err), None),
            }
        } else {
            ("unknown_runtime".to_string(), Some("No verification command available".to_string()), None)
        }
    } else {
        ("active".to_string(), None, Some(now_iso()))
    }
}

fn mcp_config_path(tool: &str) -> Option<PathBuf> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    match tool {
        "claude-desktop" => Some(home.join("Library/Application Support/Claude/claude_desktop_config.json")),
        "claude-code" => Some(home.join(".claude.json")),
        "cursor" => Some(home.join(".cursor/mcp.json")),
        "windsurf" => Some(home.join(".codeium/windsurf/mcp_config.json")),
        "codex" => Some(home.join(".codex/mcp.json")),
        _ => None,
    }
}

fn has_managed_mcp_entries(tool: &str) -> bool {
    let path = match mcp_config_path(tool) {
        Some(path) => path,
        None => return false,
    };
    let data = match fs::read_to_string(path) {
        Ok(data) => data,
        Err(_) => return false,
    };
    let json: serde_json::Value = match serde_json::from_str(&data) {
        Ok(json) => json,
        Err(_) => return false,
    };
    json.get("mcpServers")
        .and_then(|servers| servers.as_object())
        .map(|servers| {
            servers.values().any(|value| {
                value
                    .get("_managed_by")
                    .and_then(|managed| managed.as_str())
                    .map_or(false, |managed| managed == "lfc")
            })
        })
        .unwrap_or(false)
}

fn has_managed_markdown_block(path: &Path) -> bool {
    fs::read_to_string(path)
        .map(|content| content.contains("<!-- lfc:start -->") && content.contains("<!-- lfc:end -->"))
        .unwrap_or(false)
}

fn remove_managed_skills(desired: &HashSet<String>) -> Result<Vec<String>, String> {
    let skills_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(".claude/skills");
    if !skills_dir.exists() {
        return Ok(Vec::new());
    }
    let mut removed = Vec::new();
    for entry in fs::read_dir(skills_dir).map_err(|e| format!("Read skills dir error: {}", e))? {
        let path = entry.map_err(|e| format!("Read skills entry error: {}", e))?.path();
        let name = path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();
        if !name.starts_with("lfc-") {
            continue;
        }
        let logical = name.trim_start_matches("lfc-").trim_end_matches(".md").to_string();
        if desired.contains(&logical) {
            continue;
        }
        removed.push(path.to_string_lossy().to_string());
        fs::remove_dir_all(&path).or_else(|_| fs::remove_file(&path)).ok();
    }
    Ok(removed)
}

fn remove_managed_agents(desired: &HashSet<String>) -> Result<Vec<String>, String> {
    let agents_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(".claude/agents");
    if !agents_dir.exists() {
        return Ok(Vec::new());
    }
    let mut removed = Vec::new();
    for entry in fs::read_dir(agents_dir).map_err(|e| format!("Read agents dir error: {}", e))? {
        let path = entry.map_err(|e| format!("Read agents entry error: {}", e))?.path();
        let name = path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();
        if !name.starts_with("lfc-") {
            continue;
        }
        let logical = name.trim_start_matches("lfc-").trim_end_matches(".md").to_string();
        if desired.contains(&logical) {
            continue;
        }
        removed.push(path.to_string_lossy().to_string());
        fs::remove_file(&path).ok();
    }
    Ok(removed)
}

fn remove_managed_rules(tool: &str, desired: &HashSet<String>) -> Result<Vec<String>, String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let rules_dir = match tool {
        "claude-code" => home.join(".claude/rules"),
        "cursor" => home.join(".cursor/rules"),
        _ => return Ok(Vec::new()),
    };
    if !rules_dir.exists() {
        return Ok(Vec::new());
    }
    let mut removed = Vec::new();
    for entry in fs::read_dir(rules_dir).map_err(|e| format!("Read rules dir error: {}", e))? {
        let path = entry.map_err(|e| format!("Read rules entry error: {}", e))?.path();
        let name = path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();
        if !name.starts_with("lfc-") {
            continue;
        }
        let logical = name
            .trim_start_matches("lfc-")
            .trim_end_matches(".md")
            .trim_end_matches(".mdc")
            .to_string();
        if desired.contains(&logical) {
            continue;
        }
        removed.push(path.to_string_lossy().to_string());
        fs::remove_file(&path).ok();
    }
    Ok(removed)
}

fn cleanup_artifact_roots(keep: &HashSet<String>) -> Result<Vec<String>, String> {
    let mut removed = Vec::new();
    let roots = artifacts_dir();
    if roots.exists() {
        for entry in fs::read_dir(&roots).map_err(|e| format!("Read artifacts dir error: {}", e))? {
            let path = entry.map_err(|e| format!("Read artifacts entry error: {}", e))?.path();
            let name = path
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
                .unwrap_or_default();
            if keep.contains(&name) {
                continue;
            }
            removed.push(path.to_string_lossy().to_string());
            fs::remove_dir_all(&path).ok();
        }
    }
    Ok(removed)
}

async fn apply_assignments(assignments: &[SyncAssignment], removals: &[String], state: &mut LocalState) -> Result<u32, String> {
    let installed_tools = sync::detect_installed_tools().into_iter().collect::<HashSet<_>>();
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let mut instructions_by_tool: HashMap<String, Vec<String>> = HashMap::new();
    let mut cursor_inline_rules: Vec<String> = Vec::new();
    let mut mcp_by_tool: HashMap<String, Vec<sync::McpServer>> = HashMap::new();
    let mut desired_skills = HashSet::new();
    let mut desired_agents = HashSet::new();
    let mut desired_claude_rules = HashSet::new();
    let mut desired_cursor_rules = HashSet::new();
    let mut applied = 0u32;

    for assignment in assignments {
        let release_id = assignment.release.id.clone();
        let mut artifact_state = state
            .artifact_states
            .get(&release_id)
            .cloned()
            .unwrap_or(LocalArtifactState {
                artifact_release_id: release_id.clone(),
                desired_state: "active".to_string(),
                actual_state: "pending".to_string(),
                activation_state: None,
                install_root: None,
                wrapper_path: None,
                previous_release_id: None,
                last_error_code: None,
                last_error_detail: None,
                inventory_json: None,
                last_verified_at: None,
                last_transition_at: now_iso(),
            });

        artifact_state.desired_state = assignment.desired_state.clone();
        artifact_state.actual_state = "installing".to_string();
        artifact_state.last_transition_at = now_iso();

        match ensure_assignment_installed(assignment).await {
            Ok(install_result) => {
                artifact_state.install_root = Some(install_result.install_root.clone());
                artifact_state.wrapper_path = install_result.wrapper_path.clone();
                for binding in &assignment.release.manifest.bindings {
                    let content = resolve_binding_content(assignment);
                    match binding.binding_type.as_str() {
                        "instructions" => {
                            instructions_by_tool
                                .entry(binding.tool.clone())
                                .or_default()
                                .push(render_instruction_block(assignment));
                        }
                        "rule" if binding.tool == "cursor" => {
                            let inline = binding
                                .config_json
                                .as_ref()
                                .and_then(|value| value.get("inline"))
                                .and_then(|value| value.as_bool())
                                .unwrap_or(false);
                            if inline {
                                cursor_inline_rules.push(render_instruction_block(assignment));
                            } else {
                                desired_cursor_rules.insert(assignment.artifact.slug.clone());
                                sync::write_rules(&binding.tool, &assignment.artifact.slug, &content)?;
                            }
                        }
                        "rule" => {
                            desired_claude_rules.insert(assignment.artifact.slug.clone());
                            sync::write_rules(&binding.tool, &assignment.artifact.slug, &content)?;
                        }
                        "skill" => {
                            desired_skills.insert(assignment.artifact.slug.clone());
                            sync::write_skills(&binding.tool, &assignment.artifact.slug, &content)?;
                        }
                        "agent" => {
                            desired_agents.insert(assignment.artifact.slug.clone());
                            sync::write_agents(&binding.tool, &assignment.artifact.slug, &content)?;
                        }
                        "mcp" => {
                            let server_name = binding
                                .config_json
                                .as_ref()
                                .and_then(|json| json.get("serverName"))
                                .and_then(|value| value.as_str())
                                .unwrap_or(&assignment.artifact.slug)
                                .to_string();
                            let server_args = binding
                                .config_json
                                .as_ref()
                                .and_then(|json| json.get("args"))
                                .and_then(|value| value.as_array())
                                .map(|values| {
                                    values
                                        .iter()
                                        .filter_map(|value| value.as_str().map(|value| value.to_string()))
                                        .collect::<Vec<_>>()
                                })
                                .unwrap_or_else(|| {
                                    assignment
                                        .release
                                        .manifest
                                        .launch
                                        .as_ref()
                                        .map(|launch| launch.args.clone())
                                        .unwrap_or_default()
                                });
                            let env = assignment
                                .release
                                .manifest
                                .launch
                                .as_ref()
                                .map(|launch| {
                                    launch
                                        .env
                                        .iter()
                                        .filter_map(|field| {
                                            assignment
                                                .resolved_secrets
                                                .get(&field.name)
                                                .cloned()
                                                .or_else(|| field.default_value.clone())
                                                .map(|value| (field.name.clone(), value))
                                        })
                                        .collect::<HashMap<String, String>>()
                                })
                                .unwrap_or_default();
                            mcp_by_tool.entry(binding.tool.clone()).or_default().push(sync::McpServer {
                                name: server_name,
                                command: install_result
                                    .wrapper_path
                                    .clone()
                                    .or_else(|| assignment.release.manifest.launch.as_ref().map(|launch| launch.command.clone()))
                                    .unwrap_or_default(),
                                args: server_args,
                                env,
                                managed_by: "lfc".to_string(),
                            });
                        }
                        _ => {}
                    }
                }

                let (actual_state, verify_error, verified_at) =
                    verify_assignment(assignment, artifact_state.wrapper_path.as_deref());
                artifact_state.actual_state = actual_state;
                artifact_state.last_error_detail = verify_error;
                artifact_state.last_error_code = artifact_state
                    .last_error_detail
                    .as_ref()
                    .map(|_| "verify_failed".to_string());
                artifact_state.last_verified_at = verified_at;
            }
            Err(err) => {
                artifact_state.actual_state = if err.contains("python3/python not found") {
                    "failed_prerequisites".to_string()
                } else {
                    "failed".to_string()
                };
                artifact_state.last_error_code = Some("install_failed".to_string());
                artifact_state.last_error_detail = Some(err);
            }
        }

        artifact_state.last_transition_at = now_iso();
        state.artifact_states.insert(release_id, artifact_state);
        applied += 1;
    }

    for tool in ["claude-code", "codex"] {
        let target = if tool == "claude-code" {
            home.join(".claude/CLAUDE.md")
        } else {
            home.join("AGENTS.md")
        };
        let blocks = instructions_by_tool.get(tool).cloned().unwrap_or_default();
        if !blocks.is_empty() || has_managed_markdown_block(&target) {
            sync::write_markdown_config(tool, &blocks.join("\n\n"))?;
        }
    }

    let cursor_rules_path = home.join(".cursorrules");
    if !cursor_inline_rules.is_empty() || has_managed_markdown_block(&cursor_rules_path) {
        sync::write_cursor_rules(&cursor_inline_rules.join("\n\n"))?;
    }

    for tool in ["claude-desktop", "claude-code", "cursor", "windsurf", "codex"] {
        let servers = mcp_by_tool.get(tool).cloned().unwrap_or_default();
        if !servers.is_empty() || has_managed_mcp_entries(tool) {
            sync::write_mcp_config(tool, &servers)?;
        }
    }

    let _ = remove_managed_skills(&desired_skills)?;
    let _ = remove_managed_agents(&desired_agents)?;
    let _ = remove_managed_rules("claude-code", &desired_claude_rules)?;
    let _ = remove_managed_rules("cursor", &desired_cursor_rules)?;
    let keep = assignments
        .iter()
        .map(|assignment| assignment.release.id.clone())
        .collect::<HashSet<_>>();
    let _ = cleanup_artifact_roots(&keep)?;

    for release_id in removals {
        state.artifact_states.remove(release_id);
    }

    for tool in ["claude-code", "codex", "cursor", "claude-desktop", "windsurf"] {
        if !installed_tools.contains(tool) {
            continue;
        }
    }

    Ok(applied)
}

pub async fn sync_device(api_url: &str, token: &str, existing_device_id: Option<String>) -> Result<SyncRunResult, String> {
    let scans = sync::scan_tools_detailed();
    let register_response = register_device(api_url, token, existing_device_id, &scans).await?;
    let client = reqwest::Client::new();

    let mut local_state = load_local_state();
    let sync_response = client
        .post(format!("{}/api/devices/{}/sync", api_url, register_response.device.id))
        .header("Authorization", format!("Bearer {}", token))
        .json(&SyncRequest {
            detected_tools: tool_inputs(&scans),
            states: local_state.artifact_states.values().cloned().collect(),
            inventory: inventory_value(&scans),
        })
        .send()
        .await
        .map_err(|e| format!("Device sync network error: {}", e))?;

    if !sync_response.status().is_success() {
        return Err(format!("Device sync API error: {}", sync_response.status()));
    }

    let sync_response = sync_response
        .json::<DeviceSyncResponse>()
        .await
        .map_err(|e| format!("Device sync parse error: {}", e))?;

    let applied_count = apply_assignments(&sync_response.assignments, &sync_response.removals, &mut local_state).await?;
    save_local_state(&local_state)?;

    let checks: Vec<serde_json::Value> = local_state
        .artifact_states
        .values()
        .filter(|state| state.actual_state == "active" || state.actual_state == "config_applied_unverified")
        .map(|state| {
            serde_json::json!({
                "artifactReleaseId": state.artifact_release_id,
                "result": if state.actual_state == "active" { "pass" } else { "unknown" },
                "durationMs": 0,
                "detailsJson": serde_json::Value::Null,
            })
        })
        .collect();

    if !checks.is_empty() {
        let _ = client
            .post(format!("{}/api/devices/{}/health", api_url, register_response.device.id))
            .header("Authorization", format!("Bearer {}", token))
            .json(&serde_json::json!({ "checks": checks }))
            .send()
            .await;
    }

    Ok(SyncRunResult {
        device_id: register_response.device.id,
        applied_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[tokio::test(flavor = "current_thread")]
    async fn sync_device_writes_managed_artifacts() {
        let Ok(api_url) = std::env::var("LFC_TEST_API_URL") else {
            return;
        };
        let Ok(token) = std::env::var("LFC_TEST_TOKEN") else {
            return;
        };

        let temp_home = std::env::temp_dir().join(format!(
            "lfc-tray-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::create_dir_all(temp_home.join(".claude")).unwrap();
        fs::create_dir_all(temp_home.join(".codex")).unwrap();

        let previous_home = std::env::var_os("HOME");
        std::env::set_var("HOME", &temp_home);

        let result = sync_device(&api_url, &token, None).await.unwrap();
        assert!(!result.device_id.is_empty());
        assert!(result.applied_count >= 1);

        let skill_path = temp_home.join(".claude/skills/lfc-style-guide/SKILL.md");
        assert!(skill_path.exists(), "expected managed skill to be written");

        let agents_path = temp_home.join("AGENTS.md");
        assert!(agents_path.exists(), "expected managed codex instructions to be written");

        if let Some(value) = previous_home {
            std::env::set_var("HOME", value);
        } else {
            std::env::remove_var("HOME");
        }

        fs::remove_dir_all(temp_home).ok();
    }
}

fn current_device_name() -> String {
    format!(
        "{}@{}",
        std::env::var("USER").unwrap_or_else(|_| "user".to_string()),
        hostname::get().unwrap_or_default().to_string_lossy()
    )
}

async fn register_device(
    api_url: &str,
    token: &str,
    existing_device_id: Option<String>,
    scans: &[sync::ToolScan],
) -> Result<DeviceRegistrationResponse, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/devices/register", api_url))
        .header("Authorization", format!("Bearer {}", token))
        .json(&RegisterDeviceRequest {
            device_id: existing_device_id,
            name: current_device_name(),
            platform: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
            client_kind: "tray".to_string(),
            client_version: env!("CARGO_PKG_VERSION").to_string(),
            detected_tools: tool_inputs(scans),
        })
        .send()
        .await
        .map_err(|e| format!("Device register network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Device register API error: {}", response.status()));
    }

    response
        .json::<DeviceRegistrationResponse>()
        .await
        .map_err(|e| format!("Device register parse error: {}", e))
}

pub async fn upload_inventory_snapshot(
    api_url: &str,
    token: &str,
    existing_device_id: Option<String>,
    scans: &[sync::ToolScan],
) -> Result<String, String> {
    let register_response = register_device(api_url, token, existing_device_id, scans).await?;
    let client = reqwest::Client::new();
    let response = client
        .post(format!(
            "{}/api/devices/{}/inventory",
            api_url, register_response.device.id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "inventory": inventory_value(scans),
        }))
        .send()
        .await
        .map_err(|e| format!("Inventory upload network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Inventory upload API error: {}", response.status()));
    }

    Ok(register_response.device.id)
}
