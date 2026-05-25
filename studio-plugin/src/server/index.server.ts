import State from "../modules/State";
import UI from "../modules/UI";
import Communication from "../modules/Communication";


UI.init(plugin);
const elements = UI.getElements();


const toolbar = plugin.CreateToolbar("__TOOLBAR_NAME__");
const button = toolbar.CreateButton("__BUTTON_TITLE__", "__BUTTON_TOOLTIP__", "rbxassetid://__BUTTON_ICON_ID__");


elements.connectButton.Activated.Connect(() => {
	const conn = State.getActiveConnection();
	if (conn && conn.isActive) {
		Communication.deactivatePlugin(State.getActiveTabIndex());
	} else {
		Communication.activatePlugin(State.getActiveTabIndex());
	}
});


button.Click.Connect(() => {
	elements.screenGui.Enabled = !elements.screenGui.Enabled;
});


plugin.Unloading.Connect(() => {
	Communication.deactivateAll();
});


UI.updateUIState();
Communication.checkForUpdates();
