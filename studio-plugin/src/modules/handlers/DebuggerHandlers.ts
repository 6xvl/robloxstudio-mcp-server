// ScriptDebuggerService is Plugin security and not in @rbxts/types yet. Shapes are from
// Studio's bundled api_docs (content/api_docs/en-us.json, 0.740.19).
interface DebuggerLike extends Instance {
	GetThreads(this: DebuggerLike): { Id: number; Name: string }[];
	GetStackTrace(this: DebuggerLike, threadId: number, startFrame?: number): { Frames?: { Id: number }[] };
	GetRootVariables(this: DebuggerLike, frameId: number): unknown[];
	Evaluate(this: DebuggerLike, expression: string, frameId?: number): unknown;
	SetExceptionBreakMode(this: DebuggerLike, mode: EnumItem): void;
	OnStopped: ((stopped: Record<string, unknown>) => Record<string, unknown>) | undefined;
}

// Why snapshots and not a live pause: a pause freezes the whole DataModel, including this
// plugin's poll loop and any HTTP call made from the callback (probed live 2026-09-26: the
// server peer dropped off the bridge and a GetAsync inside OnStopped never returned). So the
// callback reads everything it can without yielding and resumes at once.
const MAX_SNAPSHOTS = 20;
const MAX_FRAMES = 12;
const DEFAULT_TAIL = 5;
// DebuggerResumeType and DebugBreakModeType are missing from @rbxts/types.
const Enums = Enum as unknown as Record<string, Record<string, EnumItem>>;
const BREAK_MODES = ["Never", "Always", "Unhandled"];

const debuggerService = game.GetService("ScriptDebuggerService" as keyof Services) as unknown as DebuggerLike;

let attached = false;
let watchExpressions: string[] = [];
let includeGlobals = false;
let snapshotCount = 0;
const snapshots: Record<string, unknown>[] = [];

// EnumItems and Instances do not survive JSONEncode, so everything leaves as plain data.
function plain(value: unknown, depth = 0): unknown {
	if (depth > 8) return tostring(value);
	if (typeIs(value, "table")) {
		const out: Record<string, unknown> = {};
		for (const [k, v] of pairs(value as Record<string, unknown>)) {
			out[tostring(k)] = plain(v, depth + 1);
		}
		return out;
	}
	if (typeIs(value, "string") || typeIs(value, "number") || typeIs(value, "boolean")) return value;
	if (typeIs(value, "EnumItem")) return value.Name;
	if (typeIs(value, "Instance")) return value.GetFullName();
	return value === undefined ? undefined : tostring(value);
}

function capture(info: Record<string, unknown>): Record<string, unknown> {
	const snapshot: Record<string, unknown> = {
		index: snapshotCount + 1,
		at: os.time(),
		reason: plain(info.Reason),
		exceptionText: info.ExceptionText,
	};
	const thread = debuggerService.GetThreads()[0];
	if (!thread) return snapshot;
	snapshot.thread = plain(thread);
	const frames = (debuggerService.GetStackTrace(thread.Id).Frames ?? []).filter((_, i) => i < MAX_FRAMES);
	snapshot.stack = plain(frames);
	const top = frames[0];
	if (!top) return snapshot;
	// _G, shared and script appear in every frame and bury the locals that matter.
	const variables = debuggerService.GetRootVariables(top.Id) as { Scope?: EnumItem }[];
	snapshot.locals = plain(variables.filter((v) => includeGlobals || v.Scope?.Name !== "Global"));
	const watches: Record<string, unknown> = {};
	for (const expression of watchExpressions) {
		const [ok, result] = pcall(() => debuggerService.Evaluate(expression, top.Id));
		watches[expression] = ok ? plain(result) : `error: ${tostring(result)}`;
	}
	snapshot.watches = watches;
	return snapshot;
}

// Must never yield or throw: either one leaves the game paused with nobody to resume it.
function onStopped(info: Record<string, unknown>): Record<string, unknown> {
	const [ok, snapshot] = pcall(capture, info);
	snapshotCount += 1;
	snapshots.push(ok ? snapshot : { index: snapshotCount, at: os.time(), error: tostring(snapshot) });
	if (snapshots.size() > MAX_SNAPSHOTS) snapshots.remove(0);
	return { steppedType: Enums.DebuggerResumeType.Resume };
}

function debuggerAction(requestData: Record<string, unknown>) {
	const action = requestData.action as string;

	if (action === "attach") {
		const watch = requestData.watch;
		includeGlobals = requestData.include_globals === true;
		watchExpressions = [];
		if (typeIs(watch, "table")) {
			for (const expression of watch as unknown[]) {
				if (typeIs(expression, "string")) watchExpressions.push(expression);
			}
		}
		debuggerService.OnStopped = onStopped;
		attached = true;
		return {
			success: true,
			watch: watchExpressions,
			message: "Attached. Every breakpoint hit (and exception, per exception_mode) is snapshotted and resumed immediately.",
		};
	}
	if (action === "detach") {
		debuggerService.OnStopped = undefined;
		attached = false;
		return { success: true, message: "Detached; Studio's own debugger handles pauses again." };
	}
	if (action === "snapshots") {
		const since = typeIs(requestData.since, "number") ? requestData.since : 0;
		const tail = typeIs(requestData.tail, "number") ? requestData.tail : DEFAULT_TAIL;
		const matching = snapshots.filter((s) => (s.index as number) > since);
		return {
			attached,
			total: snapshotCount,
			snapshots: matching.filter((_, i) => i >= matching.size() - tail),
		};
	}
	if (action === "clear") {
		snapshots.clear();
		return { success: true };
	}
	if (action === "exception_mode") {
		const mode = requestData.mode as string;
		if (!BREAK_MODES.includes(mode)) return { error: `mode must be one of ${BREAK_MODES.join(", ")}` };
		debuggerService.SetExceptionBreakMode(Enums.DebugBreakModeType[mode]);
		return { success: true, mode };
	}
	return { error: `Unknown action: ${action}` };
}

export = { debuggerAction };
