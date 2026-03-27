use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpServer {
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default, rename = "_managed_by")]
    pub managed_by: String,
}

// ─── Safety: backup before any write ────────────────────────────────

fn backup_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = home.join(".lfc/backups");
    fs::create_dir_all(&dir).ok();
    dir
}

/// Create a timestamped backup of a file before modifying it.
/// Returns the backup path on success.
fn backup_file(original: &PathBuf) -> Option<PathBuf> {
    if !original.exists() {
        return None;
    }
    let filename = original
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let backup_name = format!("{}.{}.bak", filename, ts);
    let backup_path = backup_dir().join(backup_name);
    match fs::copy(original, &backup_path) {
        Ok(_) => {
            println!("[LFC] Backed up {} → {}", original.display(), backup_path.display());
            Some(backup_path)
        }
        Err(e) => {
            eprintln!("[LFC] WARNING: Failed to backup {}: {}", original.display(), e);
            None
        }
    }
}

// ─── Tool detection ─────────────────────────────────────────────────

/// Detect which AI tools are installed by checking for their config directories
pub fn detect_installed_tools() -> Vec<String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let mut tools = Vec::new();

    let checks: Vec<(&str, PathBuf)> = vec![
        ("claude-desktop", home.join("Library/Application Support/Claude")),
        ("claude-code", home.join(".claude")),
        ("cursor", home.join(".cursor")),
        ("codex", home.join(".codex")),
        ("windsurf", home.join(".codeium/windsurf")),
    ];

    for (name, dir) in checks {
        if dir.exists() {
            tools.push(name.to_string());
        }
    }

    tools
}

// ─── Config writers (safe — never lose user data) ───────────────────

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

/// Write MCP config for a specific tool.
///
/// SAFETY GUARANTEES:
/// 1. Backs up the original file before any modification
/// 2. Only removes entries tagged with `_managed_by: lfc`
/// 3. If an org-managed server name collides with a user server, the user server
///    is renamed to `{name}_user` — never deleted
/// 4. Validates that user entry count is preserved after merge; aborts if not
/// 5. All other keys in the file (non-mcpServers) are preserved exactly
pub fn write_mcp_config(tool: &str, servers: &[McpServer]) -> Result<(), String> {
    let config_path = match mcp_config_path(tool) {
        Some(p) => p,
        None => {
            println!("[LFC] Skipping unsupported tool: {}", tool);
            return Ok(());
        }
    };

    // Read existing config or create empty
    let mut config: serde_json::Value = if config_path.exists() {
        let data = fs::read_to_string(&config_path).map_err(|e| format!("Read error: {}", e))?;
        serde_json::from_str(&data).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Mkdir error: {}", e))?;
        }
        serde_json::json!({})
    };

    // Ensure mcpServers key exists
    if config.get("mcpServers").is_none() {
        config["mcpServers"] = serde_json::json!({});
    }

    let mcp_servers = config["mcpServers"].as_object_mut().unwrap();

    // Count user entries BEFORE modification
    let user_entries_before: Vec<String> = mcp_servers
        .iter()
        .filter(|(_, v)| {
            v.get("_managed_by")
                .and_then(|m| m.as_str())
                .map_or(true, |m| m != "lfc")
        })
        .map(|(k, _)| k.clone())
        .collect();

    // Remove only lfc-managed entries
    let keys_to_remove: Vec<String> = mcp_servers
        .iter()
        .filter(|(_, v)| {
            v.get("_managed_by")
                .and_then(|m| m.as_str())
                .map_or(false, |m| m == "lfc")
        })
        .map(|(k, _)| k.clone())
        .collect();

    for key in &keys_to_remove {
        mcp_servers.remove(key);
    }

    // Add new lfc-managed entries, handling name collisions safely
    for server in servers {
        if mcp_servers.contains_key(&server.name) {
            // Name collision with a user entry — rename the user entry, don't delete it
            let user_entry = mcp_servers.remove(&server.name).unwrap();
            let renamed = format!("{}_user", server.name);
            println!(
                "[LFC] Name collision: renaming user's '{}' → '{}' to avoid data loss",
                server.name, renamed
            );
            mcp_servers.insert(renamed, user_entry);
        }

        let mut entry = serde_json::json!({
            "command": server.command,
            "args": server.args,
            "_managed_by": "lfc"
        });

        if !server.env.is_empty() {
            entry["env"] = serde_json::to_value(&server.env).unwrap();
        }

        mcp_servers.insert(server.name.clone(), entry);
    }

    // SAFETY CHECK: count user entries AFTER modification — must be >= before
    let user_entries_after: Vec<String> = mcp_servers
        .iter()
        .filter(|(_, v)| {
            v.get("_managed_by")
                .and_then(|m| m.as_str())
                .map_or(true, |m| m != "lfc")
        })
        .map(|(k, _)| k.clone())
        .collect();

    if user_entries_after.len() < user_entries_before.len() {
        return Err(format!(
            "SAFETY ABORT: user MCP entries would be lost in {} ({} before, {} after). Aborting write. \
             Before: {:?}, After: {:?}",
            config_path.display(),
            user_entries_before.len(),
            user_entries_after.len(),
            user_entries_before,
            user_entries_after,
        ));
    }

    // Serialize and check if anything actually changed
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Serialize error: {}", e))?;
    let existing = fs::read_to_string(&config_path).unwrap_or_default();
    if json == existing {
        return Ok(());
    }

    // Backup before writing
    backup_file(&config_path);

    fs::write(&config_path, json).map_err(|e| format!("Write error: {}", e))?;
    println!("[LFC] Wrote MCP config for {}: {} ({} user entries preserved)",
        tool, config_path.display(), user_entries_after.len());
    Ok(())
}

/// Resolve the file path for a markdown config that uses lfc markers.
fn markdown_config_path(tool: &str, config_type: &str) -> Option<PathBuf> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    match (tool, config_type) {
        ("claude-code", "instructions") => Some(home.join(".claude/CLAUDE.md")),
        ("codex", "instructions") => Some(home.join("AGENTS.md")),
        ("cursor", "rules") => Some(home.join(".cursorrules")),
        _ => None,
    }
}

/// Write markdown content using <!-- lfc:start --> / <!-- lfc:end --> markers.
///
/// SAFETY GUARANTEES:
/// 1. Backs up the original file before any modification
/// 2. Only modifies content inside the lfc markers
/// 3. Content outside markers is never touched
/// 4. If file has no markers, the managed block is appended (never replaces existing content)
fn write_markdown_with_markers(file_path: &PathBuf, content: &str) -> Result<(), String> {
    let existing = if file_path.exists() {
        fs::read_to_string(file_path).unwrap_or_default()
    } else {
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Mkdir error: {}", e))?;
        }
        String::new()
    };

    let start_marker = "<!-- lfc:start -->";
    let end_marker = "<!-- lfc:end -->";
    let managed_block = format!("{}\n{}\n{}", start_marker, content, end_marker);

    let new_content = if let Some(start) = existing.find(start_marker) {
        if let Some(end) = existing.find(end_marker) {
            let before = &existing[..start];
            let after = &existing[end + end_marker.len()..];
            format!("{}{}{}", before, managed_block, after)
        } else {
            let before = &existing[..start];
            format!("{}{}\n", before, managed_block)
        }
    } else if existing.is_empty() {
        managed_block
    } else {
        format!("{}\n\n{}\n", existing.trim_end(), managed_block)
    };

    if new_content == existing {
        return Ok(());
    }

    // SAFETY CHECK: user content (outside markers) must be preserved
    let user_before = extract_user_markdown(&existing, start_marker, end_marker);
    let user_after = extract_user_markdown(&new_content, start_marker, end_marker);
    if user_after.trim() != user_before.trim() {
        return Err(format!(
            "SAFETY ABORT: user content in {} would be modified. Aborting write.",
            file_path.display()
        ));
    }

    backup_file(file_path);
    fs::write(file_path, new_content).map_err(|e| format!("Write error: {}", e))?;
    println!("[LFC] Wrote managed markdown: {}", file_path.display());
    Ok(())
}

/// Write markdown instructions using <!-- lfc:start --> / <!-- lfc:end --> markers.
pub fn write_markdown_config(tool: &str, content: &str) -> Result<(), String> {
    let file_path = match markdown_config_path(tool, "instructions") {
        Some(p) => p,
        None => {
            println!("[LFC] Skipping instructions for unsupported tool: {}", tool);
            return Ok(());
        }
    };

    write_markdown_with_markers(&file_path, content)?;
    println!("[LFC] Wrote instructions for {}: {}", tool, file_path.display());
    Ok(())
}

/// Write cursor rules using <!-- lfc:start --> / <!-- lfc:end --> markers in .cursorrules.
/// Also supports writing managed rule files to .cursor/rules/ with lfc- prefix.
///
/// SAFETY GUARANTEES:
/// 1. Backs up the original file before any modification
/// 2. Only modifies content inside the lfc markers in .cursorrules
/// 3. For .cursor/rules/, only writes to lfc- prefixed files
/// 4. Never overwrites user-owned rule files
pub fn write_cursor_rules(content: &str) -> Result<(), String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let file_path = home.join(".cursorrules");

    write_markdown_with_markers(&file_path, content)?;
    println!("[LFC] Wrote cursor rules: {}", file_path.display());
    Ok(())
}

/// Write agent files to the tool's agents directory.
///
/// SAFETY GUARANTEES:
/// 1. Only writes to files/dirs prefixed with `lfc-`
/// 2. Never overwrites or deletes user-installed agents
/// 3. Uses `<!-- managed_by: lfc -->` marker in agent content
/// 4. If an agent dir/file exists and is NOT managed by lfc, it is never touched
pub fn write_agents(tool: &str, name: &str, content: &str) -> Result<(), String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    let agents_dir = match tool {
        "claude-code" => home.join(".claude/agents"),
        _ => {
            println!("[LFC] Skipping agents for unsupported tool: {}", tool);
            return Ok(());
        }
    };

    fs::create_dir_all(&agents_dir).map_err(|e| format!("Mkdir error: {}", e))?;

    // Use lfc- prefix for managed agents to avoid collision with user agents
    let agent_file = agents_dir.join(format!("lfc-{}.md", name));

    // If a non-lfc agent with this name exists, never touch it
    let plain_agent_file = agents_dir.join(format!("{}.md", name));
    if plain_agent_file.exists() {
        let is_ours = fs::read_to_string(&plain_agent_file)
            .map(|c| c.contains("<!-- managed_by: lfc -->"))
            .unwrap_or(false);

        if !is_ours {
            println!("[LFC] Agent '{}' exists and is user-owned — skipping (will use lfc-{} prefix)", name, name);
        }
    }

    // Write our managed agent with clear marker
    let managed_content = format!("<!-- managed_by: lfc -->\n{}", content);

    let existing = fs::read_to_string(&agent_file).unwrap_or_default();
    if existing == managed_content {
        return Ok(());
    }

    backup_file(&agent_file);
    fs::write(&agent_file, managed_content).map_err(|e| format!("Write error: {}", e))?;
    println!("[LFC] Wrote agent '{}' for {}: {}", name, tool, agent_file.display());
    Ok(())
}

/// Write rule files to the tool's rules directory.
///
/// SAFETY GUARANTEES:
/// 1. Only writes to files prefixed with `lfc-`
/// 2. Never overwrites or deletes user-installed rules
/// 3. Uses `<!-- managed_by: lfc -->` marker in rule content
/// 4. If a rule file exists and is NOT managed by lfc, it is never touched
pub fn write_rules(tool: &str, name: &str, content: &str) -> Result<(), String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    let rules_dir = match tool {
        "claude-code" => home.join(".claude/rules"),
        "cursor" => home.join(".cursor/rules"),
        _ => {
            println!("[LFC] Skipping rules for unsupported tool: {}", tool);
            return Ok(());
        }
    };

    fs::create_dir_all(&rules_dir).map_err(|e| format!("Mkdir error: {}", e))?;

    // Use lfc- prefix for managed rules
    let extension = match tool {
        "cursor" => "mdc",
        _ => "md",
    };
    let rule_file = rules_dir.join(format!("lfc-{}.{}", name, extension));

    // If a non-lfc rule with this name exists, never touch it
    let plain_rule_file = rules_dir.join(format!("{}.{}", name, extension));
    if plain_rule_file.exists() {
        let is_ours = fs::read_to_string(&plain_rule_file)
            .map(|c| c.contains("<!-- managed_by: lfc -->"))
            .unwrap_or(false);

        if !is_ours {
            println!("[LFC] Rule '{}' exists and is user-owned — skipping (will use lfc-{} prefix)", name, name);
        }
    }

    // Write our managed rule with clear marker
    let managed_content = format!("<!-- managed_by: lfc -->\n{}", content);

    let existing = fs::read_to_string(&rule_file).unwrap_or_default();
    if existing == managed_content {
        return Ok(());
    }

    backup_file(&rule_file);
    fs::write(&rule_file, managed_content).map_err(|e| format!("Write error: {}", e))?;
    println!("[LFC] Wrote rule '{}' for {}: {}", name, tool, rule_file.display());
    Ok(())
}

/// Extract content outside lfc markers (user-owned content)
fn extract_user_markdown(content: &str, start_marker: &str, end_marker: &str) -> String {
    if let Some(start) = content.find(start_marker) {
        if let Some(end) = content.find(end_marker) {
            let before = &content[..start];
            let after = &content[end + end_marker.len()..];
            format!("{}{}", before, after)
        } else {
            content[..start].to_string()
        }
    } else {
        content.to_string()
    }
}

/// Write skill files to the tool's skills directory.
///
/// SAFETY GUARANTEES:
/// 1. Only writes to files/dirs that are tagged as lfc-managed
/// 2. Never overwrites or deletes user-installed skills
/// 3. Uses a `<!-- managed_by: lfc -->` marker in skill content
/// 4. If a skill dir/file exists and is NOT managed by lfc, it is never touched
pub fn write_skills(tool: &str, name: &str, content: &str) -> Result<(), String> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    let skills_dir = match tool {
        "claude-code" => home.join(".claude/skills"),
        _ => {
            println!("[LFC] Skipping skills for unsupported tool: {}", tool);
            return Ok(());
        }
    };

    fs::create_dir_all(&skills_dir).map_err(|e| format!("Mkdir error: {}", e))?;

    // Use a subdirectory for lfc-managed skills to avoid any collision with user skills
    let skill_dir = skills_dir.join(format!("lfc-{}", name));
    let file_path = skill_dir.join("SKILL.md");

    // If a non-lfc skill with this name exists, never touch it
    let plain_skill_dir = skills_dir.join(name);
    let plain_skill_file = skills_dir.join(format!("{}.md", name));
    if plain_skill_dir.exists() || plain_skill_file.exists() {
        // Check if it's ours
        let is_ours = if plain_skill_dir.exists() {
            let marker_path = plain_skill_dir.join("SKILL.md");
            fs::read_to_string(&marker_path)
                .map(|c| c.contains("<!-- managed_by: lfc -->"))
                .unwrap_or(false)
        } else {
            fs::read_to_string(&plain_skill_file)
                .map(|c| c.contains("<!-- managed_by: lfc -->"))
                .unwrap_or(false)
        };

        if !is_ours {
            println!("[LFC] Skill '{}' exists and is user-owned — skipping (will use lfc-{} prefix)", name, name);
        }
    }

    // Write our managed skill with clear marker
    let managed_content = format!("<!-- managed_by: lfc -->\n{}", content);

    fs::create_dir_all(&skill_dir).map_err(|e| format!("Mkdir error: {}", e))?;
    let existing = fs::read_to_string(&file_path).unwrap_or_default();
    if existing == managed_content {
        return Ok(());
    }

    backup_file(&file_path);
    fs::write(&file_path, managed_content).map_err(|e| format!("Write error: {}", e))?;
    println!("[LFC] Wrote skill '{}' for {}: {}", name, tool, file_path.display());
    Ok(())
}

// ─── Local config detection ─────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalConfig {
    pub config_type: String,
    pub name: String,
    pub preview: String,
    pub content: String,
}

/// Detect locally-added configs that differ from org-managed versions.
/// Returns MCP servers not tagged with `_managed_by: lfc`, skills not managed by lfc,
/// and CLAUDE.md content outside the `<!-- lfc:start/end -->` markers.
pub fn detect_local_configs() -> Vec<LocalConfig> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let mut results = Vec::new();

    // 1. Scan MCP config files for user-added servers (not tagged _managed_by: lfc)
    let mcp_paths: Vec<(&str, PathBuf)> = vec![
        ("claude-desktop", home.join("Library/Application Support/Claude/claude_desktop_config.json")),
        ("claude-code", home.join(".claude.json")),
        ("cursor", home.join(".cursor/mcp.json")),
        ("windsurf", home.join(".codeium/windsurf/mcp_config.json")),
        ("codex", home.join(".codex/mcp.json")),
    ];

    for (tool, path) in mcp_paths {
        if !path.exists() {
            continue;
        }
        if let Ok(data) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Some(servers) = config.get("mcpServers").and_then(|s| s.as_object()) {
                    for (name, value) in servers {
                        let is_managed = value
                            .get("_managed_by")
                            .and_then(|m| m.as_str())
                            .map_or(false, |m| m == "lfc");
                        if !is_managed {
                            let preview = serde_json::to_string_pretty(value)
                                .unwrap_or_default();
                            let truncated = if preview.len() > 200 {
                                format!("{}...", &preview[..200])
                            } else {
                                preview.clone()
                            };
                            results.push(LocalConfig {
                                config_type: "mcp".to_string(),
                                name: format!("{} ({})", name, tool),
                                preview: truncated,
                                content: preview,
                            });
                        }
                    }
                }
            }
        }
    }

    // 2. Scan ~/.claude/skills/ for skill files/dirs not managed by lfc
    //    Skills can be:
    //    - Direct .md files: ~/.claude/skills/foo.md
    //    - Directories with SKILL.md: ~/.claude/skills/foo/SKILL.md
    //    - Symlinks to directories (common with npx skills): ~/.claude/skills/foo -> ...
    let skills_dir = home.join(".claude/skills");
    if skills_dir.exists() {
        if let Ok(entries) = fs::read_dir(&skills_dir) {
            for entry in entries.flatten() {
                let path = entry.path();

                let (skill_name, skill_content_path) = if path.is_dir() || path.is_symlink() {
                    let skill_md = path.join("SKILL.md");
                    if !skill_md.exists() {
                        continue;
                    }
                    let name = path
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unnamed".to_string());
                    (name, skill_md)
                } else if path.extension().map_or(false, |e| e == "md") {
                    let name = path
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unnamed".to_string());
                    (name, path.clone())
                } else {
                    continue;
                };

                // Skip lfc-managed skills (prefixed or marked)
                if skill_name.starts_with("lfc-") {
                    continue;
                }

                if let Ok(content) = fs::read_to_string(&skill_content_path) {
                    if content.contains("<!-- managed_by: lfc -->") {
                        continue;
                    }
                    let preview = if content.len() > 200 {
                        format!("{}...", &content[..200])
                    } else {
                        content.clone()
                    };
                    results.push(LocalConfig {
                        config_type: "skills".to_string(),
                        name: skill_name,
                        preview,
                        content,
                    });
                }
            }
        }
    }

    // 3. Read markdown files with lfc markers and extract user content outside markers
    let start_marker = "<!-- lfc:start -->";
    let end_marker = "<!-- lfc:end -->";

    let marker_files: Vec<(&str, &str, PathBuf)> = vec![
        ("instructions", "CLAUDE.md (user content)", home.join(".claude/CLAUDE.md")),
        ("instructions", "AGENTS.md (user content)", home.join("AGENTS.md")),
        ("rules", ".cursorrules (user content)", home.join(".cursorrules")),
    ];

    for (config_type, display_name, file_path) in marker_files {
        if file_path.exists() {
            if let Ok(content) = fs::read_to_string(&file_path) {
                let user_content = extract_user_markdown(&content, start_marker, end_marker);
                let user_content = user_content.trim().to_string();

                if !user_content.is_empty() {
                    let preview = if user_content.len() > 200 {
                        format!("{}...", &user_content[..200])
                    } else {
                        user_content.clone()
                    };
                    results.push(LocalConfig {
                        config_type: config_type.to_string(),
                        name: display_name.to_string(),
                        preview,
                        content: user_content,
                    });
                }
            }
        }
    }

    // 4. Scan ~/.claude/agents/ for agent files not managed by lfc
    let agents_dir = home.join(".claude/agents");
    if agents_dir.exists() {
        if let Ok(entries) = fs::read_dir(&agents_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.extension().map_or(false, |e| e == "md") {
                    continue;
                }
                let agent_name = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unnamed".to_string());

                // Skip lfc-managed agents
                if agent_name.starts_with("lfc-") {
                    continue;
                }

                if let Ok(content) = fs::read_to_string(&path) {
                    if content.contains("<!-- managed_by: lfc -->") {
                        continue;
                    }
                    let preview = if content.len() > 200 {
                        format!("{}...", &content[..200])
                    } else {
                        content.clone()
                    };
                    results.push(LocalConfig {
                        config_type: "agents".to_string(),
                        name: agent_name,
                        preview,
                        content,
                    });
                }
            }
        }
    }

    // 5. Scan .claude/rules/ for rule files not managed by lfc
    let rules_dir = home.join(".claude/rules");
    if rules_dir.exists() {
        if let Ok(entries) = fs::read_dir(&rules_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.extension().map_or(false, |e| e == "md") {
                    continue;
                }
                let rule_name = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unnamed".to_string());

                if rule_name.starts_with("lfc-") {
                    continue;
                }

                if let Ok(content) = fs::read_to_string(&path) {
                    if content.contains("<!-- managed_by: lfc -->") {
                        continue;
                    }
                    let preview = if content.len() > 200 {
                        format!("{}...", &content[..200])
                    } else {
                        content.clone()
                    };
                    results.push(LocalConfig {
                        config_type: "rules".to_string(),
                        name: rule_name,
                        preview,
                        content,
                    });
                }
            }
        }
    }

    // 6. Scan .cursor/rules/ for rule files not managed by lfc
    let cursor_rules_dir = home.join(".cursor/rules");
    if cursor_rules_dir.exists() {
        if let Ok(entries) = fs::read_dir(&cursor_rules_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let ext_ok = path.extension().map_or(false, |e| e == "md" || e == "mdc");
                if !ext_ok {
                    continue;
                }
                let rule_name = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unnamed".to_string());

                if rule_name.starts_with("lfc-") {
                    continue;
                }

                if let Ok(content) = fs::read_to_string(&path) {
                    if content.contains("<!-- managed_by: lfc -->") {
                        continue;
                    }
                    let preview = if content.len() > 200 {
                        format!("{}...", &content[..200])
                    } else {
                        content.clone()
                    };
                    results.push(LocalConfig {
                        config_type: "rules".to_string(),
                        name: format!("{} (cursor)", rule_name),
                        preview,
                        content,
                    });
                }
            }
        }
    }

    results
}

// ─── Tool scanning ──────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ToolScan {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub mcp_servers: Vec<ScannedMcp>,
    pub skills: Vec<ScannedItem>,
    pub agents: Vec<ScannedItem>,
    pub rules: Vec<ScannedItem>,
    pub instructions: Option<ScannedMarkdown>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScannedMcp {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub managed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScannedItem {
    pub name: String,
    pub managed: bool,
    pub preview: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScannedMarkdown {
    pub path: String,
    pub has_managed_block: bool,
    pub user_content_lines: u32,
    pub managed_content_lines: u32,
}

/// Read an MCP config file and return a list of ScannedMcp entries.
fn scan_mcp_servers(path: &PathBuf) -> Vec<ScannedMcp> {
    let data = match fs::read_to_string(path) {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };
    let config: serde_json::Value = match serde_json::from_str(&data) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let servers = match config.get("mcpServers").and_then(|s| s.as_object()) {
        Some(s) => s,
        None => return Vec::new(),
    };

    servers
        .iter()
        .map(|(name, value)| {
            let command = value
                .get("command")
                .and_then(|c| c.as_str())
                .unwrap_or("")
                .to_string();
            let args = value
                .get("args")
                .and_then(|a| a.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();
            let managed = value
                .get("_managed_by")
                .and_then(|m| m.as_str())
                .map_or(false, |m| m == "lfc");
            ScannedMcp {
                name: name.clone(),
                command,
                args,
                managed,
            }
        })
        .collect()
}

/// Scan a directory for .md (or .mdc) files and return ScannedItem entries.
fn scan_file_items(dir: &PathBuf, extensions: &[&str]) -> Vec<ScannedItem> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut items = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let ext_match = path
            .extension()
            .and_then(|e| e.to_str())
            .map_or(false, |e| extensions.contains(&e));
        if !ext_match {
            continue;
        }

        let name = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unnamed".to_string());

        if let Ok(content) = fs::read_to_string(&path) {
            let managed = name.starts_with("lfc-")
                || content.contains("<!-- managed_by: lfc -->");
            let preview = if content.len() > 100 {
                content[..100].to_string()
            } else {
                content.clone()
            };
            items.push(ScannedItem {
                name,
                managed,
                preview,
            });
        }
    }
    items
}

/// Scan the skills directory (handles dirs with SKILL.md, plain .md files, and symlinks).
fn scan_skills(dir: &PathBuf) -> Vec<ScannedItem> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut items = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();

        let (skill_name, content_path) = if path.is_dir() || path.is_symlink() {
            let skill_md = path.join("SKILL.md");
            if !skill_md.exists() {
                continue;
            }
            let name = path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "unnamed".to_string());
            (name, skill_md)
        } else if path.extension().map_or(false, |e| e == "md") {
            let name = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "unnamed".to_string());
            (name, path.clone())
        } else {
            continue;
        };

        if let Ok(content) = fs::read_to_string(&content_path) {
            let managed = skill_name.starts_with("lfc-")
                || content.contains("<!-- managed_by: lfc -->");
            let preview = if content.len() > 100 {
                content[..100].to_string()
            } else {
                content.clone()
            };
            items.push(ScannedItem {
                name: skill_name,
                managed,
                preview,
            });
        }
    }
    items
}

/// Scan a markdown instructions file for lfc markers and count lines.
fn scan_markdown_instructions(path: &PathBuf) -> Option<ScannedMarkdown> {
    let content = fs::read_to_string(path).ok()?;
    let start_marker = "<!-- lfc:start -->";
    let end_marker = "<!-- lfc:end -->";

    let has_managed_block = content.contains(start_marker) && content.contains(end_marker);

    let (user_content_lines, managed_content_lines) = if has_managed_block {
        if let (Some(start_idx), Some(end_idx)) =
            (content.find(start_marker), content.find(end_marker))
        {
            let managed_block =
                &content[start_idx + start_marker.len()..end_idx];
            let managed_lines = managed_block.lines().count() as u32;
            let user_content = extract_user_markdown(&content, start_marker, end_marker);
            let user_lines = user_content.trim().lines().count() as u32;
            (user_lines, managed_lines)
        } else {
            (content.lines().count() as u32, 0)
        }
    } else {
        (content.lines().count() as u32, 0)
    };

    Some(ScannedMarkdown {
        path: path.to_string_lossy().to_string(),
        has_managed_block,
        user_content_lines,
        managed_content_lines,
    })
}

/// Perform a detailed scan of all known AI tools, returning what each has configured.
pub fn scan_tools_detailed() -> Vec<ToolScan> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    let tool_defs: Vec<(&str, &str, PathBuf)> = vec![
        ("claude-desktop", "Claude Desktop", home.join("Library/Application Support/Claude")),
        ("claude-code", "Claude Code", home.join(".claude")),
        ("cursor", "Cursor", home.join(".cursor")),
        ("codex", "Codex", home.join(".codex")),
        ("windsurf", "Windsurf", home.join(".codeium/windsurf")),
    ];

    let mut results = Vec::new();

    for (id, name, detect_dir) in tool_defs {
        let installed = detect_dir.exists();

        let mcp_servers = if let Some(mcp_path) = mcp_config_path(id) {
            if mcp_path.exists() {
                scan_mcp_servers(&mcp_path)
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        };

        let skills = match id {
            "claude-code" => scan_skills(&home.join(".claude/skills")),
            _ => Vec::new(),
        };

        let agents = match id {
            "claude-code" => scan_file_items(&home.join(".claude/agents"), &["md"]),
            _ => Vec::new(),
        };

        let rules = match id {
            "claude-code" => scan_file_items(&home.join(".claude/rules"), &["md"]),
            "cursor" => scan_file_items(&home.join(".cursor/rules"), &["mdc", "md"]),
            _ => Vec::new(),
        };

        let instructions = match id {
            "claude-code" => {
                let path = home.join(".claude/CLAUDE.md");
                if path.exists() {
                    scan_markdown_instructions(&path)
                } else {
                    None
                }
            }
            "cursor" => {
                let path = home.join(".cursorrules");
                if path.exists() {
                    scan_markdown_instructions(&path)
                } else {
                    None
                }
            }
            "codex" => {
                let path = home.join("AGENTS.md");
                if path.exists() {
                    scan_markdown_instructions(&path)
                } else {
                    None
                }
            }
            _ => None,
        };

        results.push(ToolScan {
            id: id.to_string(),
            name: name.to_string(),
            installed,
            mcp_servers,
            skills,
            agents,
            rules,
            instructions,
        });
    }

    results
}
