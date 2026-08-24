# Roblox Studio MCP Server (6xvl extended edition)

**Connect AI assistants like Claude, Codex, Gemini, or any MCP-compatible AI to Roblox Studio**

[![NPM Version](https://img.shields.io/npm/v/@6xvl/robloxstudio-mcp)](https://www.npmjs.com/package/@6xvl/robloxstudio-mcp)

---

## What is This?

An MCP server that lets AI explore your game structure, read/edit scripts, mutate terrain/lighting/animation/sound/particles, profile performance, and route requests across multiple Studio tabs — all locally and safely.

Extended fork with 130+ tools, multi-Studio routing, Blender-parity hang controls, and a Roblox official `StudioMCP.exe` hook.

### Live-game tooling

A playtest forks the DataModel, and the plugin runs in each fork — so a running place is several **peers** at once: `edit`, `server`, and `client-1..N`. Tools that need the running game name which peer they mean.

- **`eval_server_runtime` / `eval_client_runtime`** — Luau in the live VM, **sharing its require cache**. `execute_luau` runs in the plugin VM against a fresh ModuleScript, so `require(SomeModule)` hands back a new copy and every table the game has mutated is invisible. These see the real thing.
- **`get_runtime_logs`** — output per peer, with a `since` cursor. A value that differs between server and client is the shape of every replication bug, and a merged log cannot show which side printed it.
- **`capture_script_profiler` / `capture_micro_profiler`** — Luau CPU hotspots and engine frame time on a live peer. `profile_snapshot` says a frame is slow; these say which function.
- **`get_memory_breakdown` / `get_scene_analysis`** — memory by tag and scene cost, compared across peers. Scene modes include `unparented_instances` (a leak detector) and `triangle_composition`.
- **`breakpoints`** — breakpoints and logpoints, with conditions.
- **`set_device_simulator` / `capture_device_matrix`** — emulate a device, or screenshot up to six of them in one call.
- **`set_network_profile`** — simulated latency, jitter and packet loss via `NetworkSettings`.
- **`solo_playtest` / `multiplayer_playtest`** — run and inspect a test, up to 8 clients.
- **`import_rbxm` / `export_rbxm`** — real `.rbxm` via SerializationService. Lossless, unlike `export_build`'s compact JSON.
- **`manage_instance`** — launch, close, and inspect Studio *processes*; list a place's published revisions.
- **`get_roblox_docs` / `get_roblox_skills`** — the official engine reference and the installed Studio Assistant skills. Both answer with **no Studio open**.

Ported from [Chrrxs/robloxstudio-mcp](https://github.com/Chrrxs/robloxstudio-mcp) (MIT).

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

> **Seeing `failed to connect to roblox studio: -32000` (or `[roblox-hook] ... Connection closed`)?**
> This is **harmless** and does **not** mean the server failed. It's the optional Roblox *official* `StudioMCP.exe` hook, which auto-enables when `%LOCALAPPDATA%\Roblox\mcp.bat` exists and errors out if Roblox Studio isn't running with its built-in MCP enabled. The line is logged `(non-fatal)` and the server keeps running normally. To silence it, disable the hook:
> ```bash
> claude mcp add robloxstudio -e ROBLOX_MCP_HOOK=0 -- npx -y @6xvl/robloxstudio-mcp@latest
> ```
> Or open Roblox Studio first and the hook connects instead of erroring.

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

## Troubleshooting

<details>
<summary><code>failed to connect to roblox studio: -32000</code> / <code>[roblox-hook] ... Connection closed</code></summary>

**Harmless — the server still works.** This is the optional Roblox *official* `StudioMCP.exe` hook, not the MCP server itself. It auto-enables when `%LOCALAPPDATA%\Roblox\mcp.bat` is present and reports `-32000: Connection closed` when Studio isn't running with its built-in MCP. The error is logged `(non-fatal)`; the server continues on stdio. Disable the hook to remove the message:

```bash
claude mcp add robloxstudio -e ROBLOX_MCP_HOOK=0 -- npx -y @6xvl/robloxstudio-mcp@latest
```

Set `ROBLOX_MCP_HOOK=1` to *force* the hook on, or `0` to force it off (default: auto).
</details>

<details>
<summary>Server says "Waiting for Studio plugin to connect..." forever</summary>

The Studio plugin connects to **one** HTTP port (default `58741`).

If another **robloxstudio-mcp** already owns that port, this server no longer competes with it — it enters **proxy mode** and shares that server's Studio connection (see *Several AI clients at once* below). Nothing to configure.

If something **else** is squatting on the port, the server climbs to the next free one (`58742`, `58743`, ...) and warns — and the plugin will not find it there. Pin the port so it matches the plugin:

```bash
claude mcp add robloxstudio -- npx -y @6xvl/robloxstudio-mcp@latest --port 58741
```

`--port` and `ROBLOX_STUDIO_PORT` do the same thing; the flag wins.
</details>

<details>
<summary>Several AI clients at once (two Claude terminals, Claude + Codex, ...)</summary>

**Just run them.** The first instance to start binds the port and becomes the **primary**; every later one detects it and becomes a **proxy**, forwarding its tool calls through the primary to the same Studio. You do not have to shut one down to use another, and they do not need separate ports.

Each client keeps its own `set_active_studio` choice — a per-request pin travels with every call, so one client picking a place cannot retarget another's tool calls.

Check it end to end with the primary running:

```bash
node scripts/check-proxy-mode.mjs
```

If the primary exits, a proxy promotes itself to primary within a few seconds and the plugin reconnects to it.
</details>

<details>
<summary>Several <em>Studio places</em> open at once</summary>

Different from the above: that is many AI clients, this is many **Studios**. The plugin window has one tab per port, so give each Studio its own port and add one MCP entry per port:

```bash
claude mcp add robloxstudio  -- npx -y @6xvl/robloxstudio-mcp@latest --port 58741
claude mcp add robloxstudio2 -- npx -y @6xvl/robloxstudio-mcp@latest --port 58742
```

Then connect tab 1 in the first Studio and tab 2 in the second. Within one server, `list_studios` and `set_active_studio` pick between places connected to the same port.
</details>

<details>
<summary>Plugin never shows "Connected"</summary>

- Make sure **Allow HTTP Requests** is enabled (Game Settings → Security).
- Confirm the plugin and the server target the same port (see above).
- On Windows, if `npx` misbehaves, use the `cmd /c npx ...` form shown above.
</details>

---

<!-- VERSION_LINE -->**v3.2.2** — 96+ tools, multi-Studio routing, Roblox MCP hook, Blender-parity hang controls

[Report Issues](https://github.com/6xvl/robloxstudio-mcp-server/issues) | MIT Licensed
