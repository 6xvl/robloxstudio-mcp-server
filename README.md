# Roblox Studio MCP Server (6xvl extended edition)

**Connect AI assistants like Claude, Codex, Gemini, or any MCP-compatible AI to Roblox Studio**

[![NPM Version](https://img.shields.io/npm/v/@6xvl/robloxstudio-mcp)](https://www.npmjs.com/package/@6xvl/robloxstudio-mcp)

---

## What is This?

An MCP server that lets AI explore your game structure, read/edit scripts, mutate terrain/lighting/animation/sound/particles, profile performance, and route requests across multiple Studio tabs — all locally and safely.

Extended fork with 96+ tools, multi-Studio routing, Blender-parity hang controls, and a Roblox official `StudioMCP.exe` hook.

## Setup

1. Install the [Studio plugin](https://github.com/6xvl/robloxstudio-mcp/releases) into your Plugins folder
2. Enable **Allow HTTP Requests** in Experience Settings > Security
3. Connect your AI:

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

Plugin shows "Connected" when ready.

<details>
<summary>Other MCP clients (Claude Desktop, Cursor, etc.)</summary>

```json
{
  "mcpServers": {
    "robloxstudio-mcp": {
      "command": "npx",
      "args": ["-y", "@6xvl/robloxstudio-mcp@latest"]
    }
  }
}
```

**Windows users:** if you encounter issues, use `cmd`:
```json
{
  "mcpServers": {
    "robloxstudio-mcp": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@6xvl/robloxstudio-mcp@latest"]
    }
  }
}
```
</details>

## What Can You Do?

Ask things like:
- *"Show me the full game structure"*
- *"Generate a forest at terrain region (0,0,0) → (200,50,200) with mixed grass and leafy"*
- *"Set lighting to horror preset and add fog"*
- *"Play animation 9876543210 on workspace.NPC1"*
- *"Profile the game for 10 seconds and tell me what's slow"*

<details>
<summary><strong>Inspector Edition (Read-Only)</strong></summary>

### @6xvl/robloxstudio-mcp-inspector

[![NPM Version](https://img.shields.io/npm/v/@6xvl/robloxstudio-mcp-inspector)](https://www.npmjs.com/package/@6xvl/robloxstudio-mcp-inspector)

A lighter, **read-only** edition that only exposes inspection tools. No writes, no script edits, no object creation. Ideal for safely browsing game structure, reviewing scripts, and debugging without risk of accidental changes.

**Setup** — same plugin, just swap the package name:

**Claude:**
```bash
claude mcp add robloxstudio-inspector -- npx -y @6xvl/robloxstudio-mcp-inspector@latest
```

**Codex:**
```bash
codex mcp add robloxstudio-inspector -- npx -y @6xvl/robloxstudio-mcp-inspector@latest
```

**Gemini:**
```bash
gemini mcp add robloxstudio-inspector npx --trust -- -y @6xvl/robloxstudio-mcp-inspector@latest
```

<details>
<summary>Other MCP clients</summary>

```json
{
  "mcpServers": {
    "robloxstudio-mcp-inspector": {
      "command": "npx",
      "args": ["-y", "@6xvl/robloxstudio-mcp-inspector@latest"]
    }
  }
}
```
</details>

</details>

---

<!-- VERSION_LINE -->**v3.0.0** — 96+ tools, multi-Studio routing, Roblox MCP hook, Blender-parity hang controls

[Report Issues](https://github.com/6xvl/robloxstudio-mcp-server/issues) | MIT Licensed
