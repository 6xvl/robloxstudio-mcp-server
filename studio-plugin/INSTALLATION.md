# Roblox Studio MCP Plugin Installation Guide

Complete your AI assistant integration with this Studio plugin. Works with Claude Code, Claude Desktop, Codex, Gemini, Cursor, and any MCP-compatible AI.

## Quick Installation

### Method 1: Direct Download (Recommended)

1. Download `MCPPlugin-release.rbxmx` from the latest release:
   https://github.com/6xvl/robloxstudio-mcp/releases/latest
2. Save to your plugins folder:
   - **Windows**: `%LOCALAPPDATA%\Roblox\Plugins\`
   - **macOS**: `~/Documents/Roblox/Plugins/`
3. Restart Studio. Plugin appears in toolbar automatically.

### Method 2: Auto-install via npx

```bash
npx -y @6xvl/robloxstudio-mcp --install-plugin
```

Downloads + drops the plugin into your Roblox plugins folder.

## Setup & Configuration

### 1. Enable HTTP Requests (Required)

**Game Settings** → **Security** → **Allow HTTP Requests**

### 2. Activate the Plugin

Click **MCP Server** in the plugins toolbar.
- **Green** = connected
- **Amber** = waiting for MCP server
- **Red** = error

### 3. Install MCP Server

**Claude Code:**
```bash
claude mcp add robloxstudio -- npx -y @6xvl/robloxstudio-mcp@latest
```

**Codex CLI:**
```bash
codex mcp add robloxstudio -- npx -y @6xvl/robloxstudio-mcp@latest
```

**Gemini CLI:**
```bash
gemini mcp add robloxstudio npx --trust -- -y @6xvl/robloxstudio-mcp@latest
```

**Other clients (JSON config):**
```json
{
  "mcpServers": {
    "robloxstudio": {
      "command": "npx",
      "args": ["-y", "@6xvl/robloxstudio-mcp@latest"]
    }
  }
}
```

<details>
<summary>Windows users (if npx not found)</summary>

```json
{
  "mcpServers": {
    "robloxstudio": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@6xvl/robloxstudio-mcp@latest"]
    }
  }
}
```
</details>

## How It Works

1. AI calls tool → MCP server queues request
2. Plugin long-polls every ~300 ms for work
3. Plugin executes Studio API calls
4. Plugin responds with extracted data
5. AI receives result

**96+ tools** across scripts, instances, terrain, lighting, animation, sound, particles, tweens, materials, profiling, and multi-Studio routing.

## Troubleshooting

### Plugin missing from toolbar
- Verify file is in the correct plugins folder
- Restart Studio completely
- Check Output window for errors

### "HTTP 403 Forbidden"
- Enable **Allow HTTP Requests** in Game Settings → Security
- Verify MCP server is running

### Plugin shows "Disconnected"
- Normal until MCP server runs
- Click **MCP Server** button to activate
- Confirm npx command launched the server

### Connection issues
- Check firewall isn't blocking localhost:58741
- Restart Studio + AI assistant
- Run `npx -y @6xvl/robloxstudio-mcp` manually and inspect stderr

## Security & Privacy

- **Local-only** — all communication stays on your machine (localhost:58741)
- **No external servers** — plugin talks only to localhost
- **Studio-state guard** — refuses non-runtime endpoints during playtest
- **8 MB response cap** — bounded memory use
- **No data collection**
