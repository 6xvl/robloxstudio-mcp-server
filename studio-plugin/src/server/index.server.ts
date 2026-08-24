import { RunService } from "@rbxts/services";
import State from "../modules/State";
import UI from "../modules/UI";
import Communication from "../modules/Communication";
import RuntimeLogBuffer from "../modules/RuntimeLogBuffer";
import { cleanupLegacyEditBridges, ensureRuntimeBridgeInstalled } from "../modules/EvalBridges";

// Attach the per-peer LogService listener before anything else, so boot-time prints from
// the place's own scripts are captured rather than missed. Idempotent.
RuntimeLogBuffer.install();

UI.init(plugin);
const elements = UI.getElements();

// WHICH DATAMODEL THIS COPY OF THE PLUGIN IS IN. A playtest forks the DataModel, and the
// plugin runs again in each fork -- so there is one plugin instance in edit, one in the
// play server, and one per play client. Everything below that says "peer" means one of
// those, and the MCP bridge addresses them by exactly this name.
function peerRole(): "edit" | "server" | "client" {
	if (!RunService.IsRunMode()) return "edit";
	if (RunService.IsServer()) return "server";
	return "client";
}


const toolbar = plugin.CreateToolbar("__TOOLBAR_NAME__");
const button = toolbar.CreateButton("__BUTTON_TITLE__", "__BUTTON_TOOLTIP__", "rbxassetid://__BUTTON_ICON_ID__");


// Remembered across Studio restarts. Without this the plugin came up DISCONNECTED every
// time, and had to be toggled by hand before any tool call could reach Studio -- which is
// most of the "the MCP is broken again" experience. Connecting is a decision the user
// already made; it should not need making twice.
//
// A server restart was never the problem: the poll loop already retries with backoff, and
// /poll re-registers an instanceId it does not know. Only "was it connected at all" was
// being forgotten.
const AUTOCONNECT_KEY = "mcp_autoconnect_ports";

function rememberActive() {
	const ports: number[] = [];
	for (const conn of State.getConnections()) {
		if (conn.isActive) ports.push(conn.port);
	}
	plugin.SetSetting(AUTOCONNECT_KEY, ports);
}

elements.connectButton.Activated.Connect(() => {
	const conn = State.getActiveConnection();
	if (conn && conn.isActive) {
		Communication.deactivatePlugin(State.getActiveTabIndex());
	} else {
		Communication.activatePlugin(State.getActiveTabIndex());
	}
	rememberActive();
});

// Reconnect whatever was connected when Studio last closed.
//
// Deferred rather than immediate: UI.init has run, but activatePlugin reads tab widgets
// that settle a frame later. Failing here is not fatal either -- the poll loop retries,
// so a server that is not up yet is simply found a few seconds later.
task.defer(() => {
	const saved = plugin.GetSetting(AUTOCONNECT_KEY);
	if (!typeIs(saved, "table")) return;
	const ports = saved as number[];
	State.getConnections().forEach((conn, i) => {
		if (!conn.isActive && ports.includes(conn.port)) {
			Communication.activatePlugin(i);
		}
	});
});

/*
	PLAY PEERS REGISTER THEMSELVES.

	Connecting is a click in the plugin's own window, and that window does not exist in a
	play DataModel -- so the server and client peers used to load, run, and never register
	with the bridge at all. Every tool that has to reach a live VM (eval_server_runtime,
	eval_client_runtime, the profilers, get_runtime_logs from a peer) was therefore asking
	for a peer that was never going to answer.

	They inherit the edit peer's port rather than being configured: the whole point is that
	starting a playtest needs no setup. Falling back to the base port covers the first run,
	before anything has been remembered.

	Deferred past UI.init for the same reason the block above is -- activatePlugin reads the
	URL field, which settles a frame later -- and given a longer beat here because a play DM
	is mid-boot and busy.
*/
task.delay(2, () => {
	const role = peerRole();

	if (role === "edit") {
		// Older builds left their bridge scripts in the edit DataModel, where they get
		// saved into the place. Current ones live only in play forks and die with them.
		cleanupLegacyEditBridges();
		return;
	}

	const installed = ensureRuntimeBridgeInstalled();
	if (!installed.installed) {
		warn(`[robloxstudio-mcp] runtime eval bridge install failed: ${installed.error}`);
	}

	const conn = State.getActiveConnection();
	if (conn.isActive) return;

	const saved = plugin.GetSetting(AUTOCONNECT_KEY);
	const ports = typeIs(saved, "table") ? (saved as number[]) : [];
	const port = ports.size() > 0 ? ports[0] : State.BASE_PORT;
	conn.port = port;
	conn.serverUrl = `http://localhost:${port}`;
	elements.urlInput.Text = conn.serverUrl;
	Communication.activatePlugin(State.getActiveTabIndex());
});


button.Click.Connect(() => {
	elements.screenGui.Enabled = !elements.screenGui.Enabled;
});


plugin.Unloading.Connect(() => {
	Communication.deactivateAll();
});


UI.updateUIState();
Communication.checkForUpdates();
