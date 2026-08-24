import State from "../modules/State";
import UI from "../modules/UI";
import Communication from "../modules/Communication";


UI.init(plugin);
const elements = UI.getElements();


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


button.Click.Connect(() => {
	elements.screenGui.Enabled = !elements.screenGui.Enabled;
});


plugin.Unloading.Connect(() => {
	Communication.deactivateAll();
});


UI.updateUIState();
Communication.checkForUpdates();
