// Hot reload: swap in newly built handler code without reopening the place.
//
// Studio only rereads a plugin's .rbxmx when the place opens, so a rebuilt MCP plugin used to
// need a reopen to take effect. Instead the MCP server sends the freshly compiled modules and
// this rebuilds them as real ModuleScripts. roblox-ts wires modules together with TS.import,
// which walks script.Parent, so the new tree mirrors the plugin's own layout: a `modules`
// folder with the new code beside copies of the unchanged `include` (RuntimeLib) and
// `node_modules`. The live poll loop then routes requests to the new handlers.
//
// What this cannot reload: the poll loop, UI and this file, which were running before the
// reload and keep running. Changes to those still need a place reopen.

import EditorHandlers from "./EditorHandlers";

const RunService = game.GetService("RunService");

type Handler = (data: Record<string, unknown>) => unknown;
interface FreshCommunication {
	routes: Record<string, Handler>;
}
interface FreshHandlers {
	init?: (p?: Plugin) => void;
	shutdown?: () => void;
}

let pluginRef: Plugin | undefined;
let generation = 0;
let liveRoot: Folder | undefined;
// The EditorHandlers copy currently wired in, so the next reload can release it. Starts as the
// copy the plugin booted with.
let liveEditor: FreshHandlers | undefined = EditorHandlers;

function init(p: Plugin): void {
	pluginRef = p;
}

// This file sits at <root>/modules/handlers/ReloadHandlers, so the plugin root is 3 up.
function pluginRoot(): Instance | undefined {
	return script.Parent?.Parent?.Parent;
}

function placeModule(root: Instance, path: string, source: string): void {
	const parts = path.split("/");
	let parent = root;
	for (let i = 0; i < parts.size() - 1; i++) {
		let folder = parent.FindFirstChild(parts[i]);
		if (!folder) {
			folder = new Instance("Folder");
			folder.Name = parts[i];
			folder.Parent = parent;
		}
		parent = folder;
	}
	const module = new Instance("ModuleScript");
	module.Name = parts[parts.size() - 1];
	(module as unknown as { Source: string }).Source = source;
	module.Parent = parent;
}

function reloadPlugin(requestData: Record<string, unknown>, setRouteOverride: (routes: Record<string, Handler>) => void) {
	if (RunService.IsRunning()) return { error: "Reload only runs in edit mode; stop the playtest first." };
	const files = requestData.files;
	if (!typeIs(files, "table")) return { error: "files is required (map of module path to compiled source)" };

	const source = pluginRoot();
	if (!source) return { error: "Could not locate the plugin root to copy include and node_modules from" };

	const root = new Instance("Folder");
	root.Name = `MCPReload_${generation + 1}`;
	for (const name of ["include", "node_modules"]) {
		const original = source.FindFirstChild(name);
		if (!original) {
			root.Destroy();
			return { error: `Plugin root has no ${name} to copy` };
		}
		original.Clone().Parent = root;
	}

	let moduleCount = 0;
	for (const [path, text] of pairs(files as Record<string, unknown>)) {
		if (!typeIs(path, "string") || !typeIs(text, "string")) continue;
		placeModule(root, path, text);
		moduleCount += 1;
	}

	const communicationModule = root.FindFirstChild("modules")?.FindFirstChild("Communication");
	if (!communicationModule || !communicationModule.IsA("ModuleScript")) {
		root.Destroy();
		return { error: "The sent files have no modules/Communication" };
	}

	const [ok, fresh] = pcall(() => require(communicationModule) as FreshCommunication);
	if (!ok || !typeIs(fresh, "table") || !typeIs(fresh.routes, "table")) {
		root.Destroy();
		return { error: `New code failed to load, kept the running version: ${tostring(fresh)}` };
	}

	const handlers = root.FindFirstChild("modules")?.FindFirstChild("handlers");
	const editorModule = handlers?.FindFirstChild("EditorHandlers");
	const breakpointModule = handlers?.FindFirstChild("BreakpointHandlers");
	const freshEditor = editorModule?.IsA("ModuleScript") ? (require(editorModule) as FreshHandlers) : undefined;
	const freshBreakpoints = breakpointModule?.IsA("ModuleScript") ? (require(breakpointModule) as FreshHandlers) : undefined;

	// Release the previous copy's listeners before the new one registers the same names.
	liveEditor?.shutdown?.();
	freshEditor?.init?.();
	freshBreakpoints?.init?.(pluginRef);

	setRouteOverride(fresh.routes);
	liveRoot?.Destroy();
	liveRoot = root;
	liveEditor = freshEditor;
	generation += 1;

	return {
		success: true,
		generation,
		modules: moduleCount,
		message: `Reloaded ${moduleCount} modules (generation ${generation}). Poll loop, UI and reload code keep the version that was open.`,
	};
}

export = { init, reloadPlugin };
