import Utils from "../Utils";

const { getInstancePath, getInstanceByPath, readScriptSource } = Utils;

const RunService = game.GetService("RunService");
const ChangeHistoryService = game.GetService("ChangeHistoryService");

// ScriptEditorService/ScriptDocument members below are Plugin security; contracts are from
// create.roblox.com ScriptEditorService.md and Studio's bundled api_docs (0.740.19).
interface ScriptDocumentLike extends Instance {
	GetScript(this: ScriptDocumentLike): LuaSourceContainer | undefined;
	IsCommandBar(this: ScriptDocumentLike): boolean;
	GetLineCount(this: ScriptDocumentLike): number;
	GetSelection(this: ScriptDocumentLike): LuaTuple<[number, number, number, number]>;
	MultiEditTextAsync(this: ScriptDocumentLike, edits: unknown[]): LuaTuple<[boolean, string?]>;
	ReviewableTextEditsAsync(this: ScriptDocumentLike, changes: unknown[]): LuaTuple<[boolean, string?]>;
}

interface ScriptEditorLike extends Instance {
	GetScriptDocuments(this: ScriptEditorLike): ScriptDocumentLike[];
	FindScriptDocument(this: ScriptEditorLike, target: LuaSourceContainer): ScriptDocumentLike | undefined;
	GetEditorSource(this: ScriptEditorLike, target: LuaSourceContainer): string;
	OpenScriptDocumentAsync(this: ScriptEditorLike, target: LuaSourceContainer, options?: unknown): LuaTuple<[boolean, string?]>;
	RegisterScriptAnalysisCallback(this: ScriptEditorLike, name: string, priority: number, callback: Callback): void;
	DeregisterScriptAnalysisCallback(this: ScriptEditorLike, name: string): void;
	TextDocumentDidChange: RBXScriptSignal<(document: ScriptDocumentLike, changes: unknown) => void>;
	TextDocumentDidOpen: RBXScriptSignal<(document: ScriptDocumentLike) => void>;
	TextDocumentDidClose: RBXScriptSignal<(document: ScriptDocumentLike) => void>;
}

const ScriptEditorService = game.GetService("ScriptEditorService" as keyof Services) as unknown as ScriptEditorLike;

const ANALYSIS_CALLBACK = "MCPDiagnostics";
const REFRESH_CALLBACK = "MCPDiagnosticsRefresh";
const HISTORY_LIMIT = 300;
const EDIT_BURST_SECONDS = 5;
const SEVERITIES = ["Error", "Warning", "Information", "Hint"];

interface Diagnostic {
	line: number;
	end_line?: number;
	start_character?: number;
	end_character?: number;
	message: string;
	severity?: string;
	code?: string;
}

const diagnosticsByScript = new Map<LuaSourceContainer, Diagnostic[]>();
let analysisRegistered = false;

interface ActivityEntry {
	at: number;
	kind: string;
	detail: string;
	script?: string;
	count?: number;
}
const history: ActivityEntry[] = [];

function record(kind: string, detail: string, scriptPath?: string) {
	history.push({ at: os.time(), kind, detail, script: scriptPath });
	if (history.size() > HISTORY_LIMIT) history.remove(0);
}

function resolveScript(requestData: Record<string, unknown>): LuaTuple<[LuaSourceContainer?, string?]> {
	const path = requestData.path;
	if (!typeIs(path, "string") || path === "") return $tuple(undefined, "path is required");
	const instance = getInstanceByPath(path);
	if (!instance) return $tuple(undefined, `Instance not found: ${path}`);
	if (!instance.IsA("LuaSourceContainer")) return $tuple(undefined, `${path} is a ${instance.ClassName}, not a script`);
	return $tuple(instance, undefined);
}

function documentPath(document: ScriptDocumentLike): string | undefined {
	const [ok, target] = pcall(() => document.GetScript());
	return ok && target ? getInstancePath(target) : undefined;
}

function listDocuments() {
	const documents = [];
	for (const document of ScriptEditorService.GetScriptDocuments()) {
		if (document.IsCommandBar()) continue;
		const [cursorLine, cursorCharacter, anchorLine, anchorCharacter] = document.GetSelection();
		const target = document.GetScript();
		documents.push({
			path: documentPath(document),
			lineCount: document.GetLineCount(),
			selection: { cursorLine, cursorCharacter, anchorLine, anchorCharacter },
			unsavedChanges: target ? ScriptEditorService.GetEditorSource(target) !== readScriptSource(target) : undefined,
		});
	}
	return { documents };
}

function readEditorSource(requestData: Record<string, unknown>) {
	const [target, err] = resolveScript(requestData);
	if (!target) return { error: err };
	const editorSource = ScriptEditorService.GetEditorSource(target);
	return {
		path: getInstancePath(target),
		open: ScriptEditorService.FindScriptDocument(target) !== undefined,
		unsavedChanges: editorSource !== readScriptSource(target),
		source: editorSource,
	};
}

function openDocument(target: LuaSourceContainer, requestData: Record<string, unknown>): string | undefined {
	const line = requestData.line;
	const options = typeIs(line, "number")
		? { HighlightRange: { Start: { Line: line, Character: 1 }, End: { Line: line, Character: 1 } } }
		: undefined;
	const [ok, err] = ScriptEditorService.OpenScriptDocumentAsync(target, options);
	return ok ? undefined : `OpenScriptDocumentAsync failed: ${err}`;
}

// Edits go through the open editor tab, so they land in the user's undo stack. `reviewable`
// shows them as inline diffs the user accepts or rejects instead of applying them outright.
function editDocument(requestData: Record<string, unknown>) {
	const [target, err] = resolveScript(requestData);
	if (!target) return { error: err };
	const edits = requestData.edits;
	if (!typeIs(edits, "table") || (edits as unknown[]).size() === 0) return { error: "edits must be a non-empty array" };

	const openError = openDocument(target, requestData);
	if (openError) return { error: openError };
	const document = ScriptEditorService.FindScriptDocument(target);
	if (!document) return { error: "The script opened but no ScriptDocument appeared" };

	const reviewable = requestData.reviewable === true;
	const converted = [];
	for (const raw of edits as Record<string, unknown>[]) {
		if (!typeIs(raw.text, "string") || !typeIs(raw.start_line, "number")) {
			return { error: "each edit needs text and start_line" };
		}
		if (reviewable) {
			converted.push({ Text: raw.text, StartLine: raw.start_line, EndLine: raw.end_line });
		} else {
			if (!typeIs(raw.end_line, "number")) return { error: "end_line is required unless reviewable" };
			converted.push({
				NewText: raw.text,
				StartLine: raw.start_line,
				StartCharacter: (raw.start_character as number) ?? 1,
				EndLine: raw.end_line,
				EndCharacter: (raw.end_character as number) ?? 1,
			});
		}
	}

	const [ok, reason] = reviewable
		? document.ReviewableTextEditsAsync(converted)
		: document.MultiEditTextAsync(converted);
	if (!ok) return { error: `${reviewable ? "ReviewableTextEditsAsync" : "MultiEditTextAsync"} failed: ${reason}` };
	return {
		success: true,
		reviewable,
		applied: converted.size(),
		lineCount: document.GetLineCount(),
		message: reviewable ? "Diffs are shown in the editor for the user to accept or reject" : "Applied in the editor (undoable)",
	};
}

function analysisCallback(request: { script?: LuaSourceContainer }) {
	const diagnostics = [];
	const entries = request.script ? diagnosticsByScript.get(request.script) : undefined;
	const lines = entries && request.script ? ScriptEditorService.GetEditorSource(request.script).split(string.char(10)) : [];
	for (const entry of entries ?? []) {
		const endLine = entry.end_line ?? entry.line;
		// Without an end character, underline the whole last line rather than guess a width.
		const lineLength = (lines[endLine - 1] ?? "").size();
		diagnostics.push({
			range: {
				start: { line: entry.line, character: entry.start_character ?? 1 },
				["end"]: { line: endLine, character: entry.end_character ?? math.max(lineLength + 1, 2) },
			},
			code: entry.code ?? "MCP",
			message: entry.message,
			severity: Enum.Severity[(entry.severity ?? "Warning") as "Warning"],
		});
	}
	return { diagnostics };
}

// Registering does not re-run analysis, only deregistering does (docs, and seen live: a new
// diagnostic stayed hidden until the next edit). A throwaway callback forces the re-run.
function refreshAnalysis() {
	if (analysisRegistered) ScriptEditorService.DeregisterScriptAnalysisCallback(ANALYSIS_CALLBACK);
	analysisRegistered = false;
	if (diagnosticsByScript.size() === 0) return;
	ScriptEditorService.RegisterScriptAnalysisCallback(ANALYSIS_CALLBACK, 100, analysisCallback);
	analysisRegistered = true;
	ScriptEditorService.RegisterScriptAnalysisCallback(REFRESH_CALLBACK, 101, () => ({ diagnostics: [] }));
	ScriptEditorService.DeregisterScriptAnalysisCallback(REFRESH_CALLBACK);
}

function setDiagnostics(requestData: Record<string, unknown>) {
	const action = requestData.action as string;
	if (action === "clear") {
		if (typeIs(requestData.path, "string")) {
			const [target, err] = resolveScript(requestData);
			if (!target) return { error: err };
			diagnosticsByScript.delete(target);
		} else {
			diagnosticsByScript.clear();
		}
		refreshAnalysis();
		return { success: true, scriptsWithDiagnostics: diagnosticsByScript.size() };
	}
	if (action === "list") {
		const scripts: Record<string, Diagnostic[]> = {};
		for (const [target, entries] of diagnosticsByScript) scripts[getInstancePath(target)] = entries;
		return { scripts };
	}

	const [target, err] = resolveScript(requestData);
	if (!target) return { error: err };
	const raw = requestData.diagnostics;
	if (!typeIs(raw, "table")) return { error: "diagnostics must be an array" };
	const entries: Diagnostic[] = [];
	for (const entry of raw as Diagnostic[]) {
		if (!typeIs(entry.line, "number") || !typeIs(entry.message, "string")) {
			return { error: "each diagnostic needs line and message" };
		}
		if (entry.severity !== undefined && !SEVERITIES.includes(entry.severity)) {
			return { error: `severity must be one of ${SEVERITIES.join(", ")}` };
		}
		entries.push(entry);
	}
	if (entries.size() === 0) diagnosticsByScript.delete(target);
	else diagnosticsByScript.set(target, entries);
	refreshAnalysis();
	return { success: true, path: getInstancePath(target), count: entries.size() };
}

function scriptEditor(requestData: Record<string, unknown>) {
	const action = requestData.action as string;
	if (action === "documents") return listDocuments();
	if (action === "read") return readEditorSource(requestData);
	if (action === "open") {
		const [target, err] = resolveScript(requestData);
		if (!target) return { error: err };
		const openError = openDocument(target, requestData);
		return openError ? { error: openError } : { success: true };
	}
	if (action === "edit") return editDocument(requestData);
	if (action === "diagnostics_set" || action === "clear" || action === "list") {
		return setDiagnostics({ ...requestData, action: action === "diagnostics_set" ? "set" : action });
	}
	return { error: `Unknown action: ${action}` };
}

// The service only exists in a Team Create session; unpublished or solo places have none.
function collaborators() {
	const people: Record<string, unknown>[] = [];
	const service = game.FindService("CollaboratorsService");
	if (!service) return people;
	for (const child of service.GetChildren()) {
		if (!child.IsA("Collaborator" as keyof Instances)) continue;
		const collaborator = child as unknown as Record<string, unknown>;
		people.push({
			username: collaborator.Username,
			userId: collaborator.UserId,
			idle: collaborator.IsIdle,
			status: tostring(collaborator.Status),
			documentGuid: collaborator.CurDocGUID,
			line: collaborator.CurScriptLineNumber,
		});
	}
	return people;
}

function studioActivity(requestData: Record<string, unknown>) {
	const since = typeIs(requestData.since, "number") ? requestData.since : 0;
	const events = history.filter((entry) => entry.at >= since);
	const [ok, people] = pcall(collaborators);
	return {
		now: os.time(),
		teamCreate: game.FindService("CollaboratorsService") !== undefined,
		collaborators: ok ? people : [],
		collaboratorsError: ok ? undefined : tostring(people),
		events,
	};
}

const connections: RBXScriptConnection[] = [];

function init() {
	if (RunService.IsRunning()) return;
	connections.push(ChangeHistoryService.OnUndo.Connect((waypoint) => record("undo", waypoint)));
	connections.push(ChangeHistoryService.OnRedo.Connect((waypoint) => record("redo", waypoint)));
	const recordings = ChangeHistoryService as unknown as {
		OnRecordingFinished: RBXScriptSignal<(name: string, displayName?: string) => void>;
	};
	connections.push(recordings.OnRecordingFinished.Connect((name, displayName) => record("change", displayName ?? name)));
	connections.push(ScriptEditorService.TextDocumentDidOpen.Connect((document) => record("open", "", documentPath(document))));
	connections.push(ScriptEditorService.TextDocumentDidClose.Connect((document) => record("close", "", documentPath(document))));
	// Fires per keystroke, so a burst of typing in one target folds into a single entry.
	connections.push(ScriptEditorService.TextDocumentDidChange.Connect((document, changes) => {
		if (document.IsCommandBar()) return;
		const path = documentPath(document);
		const firstLine = (changes as { range: { start: { line: number } } }[])[0]?.range.start.line;
		const last = history[history.size() - 1];
		if (last && last.kind === "edit" && last.script === path && os.time() - last.at <= EDIT_BURST_SECONDS) {
			last.at = os.time();
			last.count = (last.count ?? 1) + 1;
			last.detail = `near line ${firstLine}`;
			return;
		}
		record("edit", `near line ${firstLine}`, path);
	}));
}

// Called by a hot reload before the new copy of this module takes over, so the old copy
// stops recording and its Script Analysis callback name is free to register again.
function shutdown() {
	for (const connection of connections) connection.Disconnect();
	connections.clear();
	if (analysisRegistered) ScriptEditorService.DeregisterScriptAnalysisCallback(ANALYSIS_CALLBACK);
	analysisRegistered = false;
}

export = { scriptEditor, studioActivity, init, shutdown };
