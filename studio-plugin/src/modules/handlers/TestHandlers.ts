import { HttpService, LogService, RunService } from "@rbxts/services";

const StudioTestService = game.GetService("StudioTestService");
const ServerScriptService = game.GetService("ServerScriptService");
const ScriptEditorService = game.GetService("ScriptEditorService");

const STOP_SIGNAL = "__MCP_STOP__";
const NAV_SIGNAL = "__MCP_NAV__";
const NAV_RESULT = "__MCP_NAV_RESULT__";
const STOP_CONFIRM_SECONDS = 5;

interface OutputEntry {
	message: string;
	messageType: string;
	timestamp: number;
}

let testRunning = false;
let outputBuffer: OutputEntry[] = [];
let logConnection: RBXScriptConnection | undefined;
let testResult: unknown;
let testError: string | undefined;
let stopListenerScript: Script | undefined;
let navResultCallback: ((json: string) => void) | undefined;

function buildCommandListenerSource(): string {
	return `local LogService = game:GetService("LogService")
local StudioTestService = game:GetService("StudioTestService")
local PathfindingService = game:GetService("PathfindingService")
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local NAV_SIG = "${NAV_SIGNAL}"
local NAV_RES = "${NAV_RESULT}"
LogService.MessageOut:Connect(function(msg)
	if msg == "${STOP_SIGNAL}" then
		pcall(function() StudioTestService:EndTest("stopped_by_mcp") end)
	elseif string.sub(msg, 1, #NAV_SIG + 1) == NAV_SIG .. ":" then
		local json = string.sub(msg, #NAV_SIG + 2)
		task.spawn(function()
			local ok, d = pcall(function() return HttpService:JSONDecode(json) end)
			if not ok or not d then
				print(NAV_RES .. ':{"success":false,"error":"parse_error"}')
				return
			end
			local ps = Players:GetPlayers()
			if #ps == 0 then
				print(NAV_RES .. ':{"success":false,"error":"no_players"}')
				return
			end
			local char = ps[1].Character or ps[1].CharacterAdded:Wait()
			local hum = char:FindFirstChildOfClass("Humanoid")
			local root = char:FindFirstChild("HumanoidRootPart")
			if not hum or not root then
				print(NAV_RES .. ':{"success":false,"error":"no_humanoid"}')
				return
			end
			local target
			if d.instancePath then
				local parts = string.split(d.instancePath, ".")
				local cur = game
				for i = 2, #parts do
					cur = cur:FindFirstChild(parts[i])
					if not cur then
						print(NAV_RES .. ':{"success":false,"error":"instance_not_found"}')
						return
					end
				end
				if cur:IsA("BasePart") then target = cur.Position
				elseif cur:IsA("Model") and cur.PrimaryPart then target = cur.PrimaryPart.Position
				else target = cur:GetPivot().Position end
			else
				target = Vector3.new(d.x or 0, d.y or 0, d.z or 0)
			end
			local path = PathfindingService:CreatePath({AgentRadius=2,AgentHeight=5,AgentCanJump=true})
			local pok = pcall(function() path:ComputeAsync(root.Position, target) end)
			local method = "direct"
			if pok and path.Status == Enum.PathStatus.Success then
				method = "pathfinding"
				for _, wp in ipairs(path:GetWaypoints()) do
					hum:MoveTo(wp.Position)
					if wp.Action == Enum.PathWaypointAction.Jump then hum.Jump = true end
					hum.MoveToFinished:Wait()
				end
			else
				hum:MoveTo(target)
				hum.MoveToFinished:Wait()
			end
			local fp = root.Position
			print(NAV_RES .. ':{"success":true,"method":"' .. method .. '","position":[' .. fp.X .. ',' .. fp.Y .. ',' .. fp.Z .. ']}')
		end)
	end
end)`;
}

function injectStopListener() {
	const listener = new Instance("Script");
	listener.Name = "__MCP_CommandListener";
	listener.Parent = ServerScriptService;

	const source = buildCommandListenerSource();
	const [seOk] = pcall(() => {
		ScriptEditorService.UpdateSourceAsync(listener, () => source);
	});
	if (!seOk) {
		(listener as unknown as { Source: string }).Source = source;
	}

	stopListenerScript = listener;
}

function cleanupStopListener() {
	if (stopListenerScript) {
		pcall(() => stopListenerScript!.Destroy());
		stopListenerScript = undefined;
	}
}

function startPlaytest(requestData: Record<string, unknown>) {
	const mode = requestData.mode as string | undefined;
	const numPlayers = requestData.numPlayers as number | undefined;

	if (mode !== "play" && mode !== "run") {
		return { error: 'mode must be "play" or "run"' };
	}

	if (testRunning) {
		return { error: "A test is already running" };
	}

	testRunning = true;
	outputBuffer = [];
	testResult = undefined;
	testError = undefined;

	cleanupStopListener();

	logConnection = LogService.MessageOut.Connect((message, messageType) => {
		if (message === STOP_SIGNAL) return;
		if (message.sub(1, NAV_SIGNAL.size()) === NAV_SIGNAL) return;
		if (message.sub(1, NAV_RESULT.size() + 1) === `${NAV_RESULT}:`) {
			if (navResultCallback) {
				navResultCallback(message.sub(NAV_RESULT.size() + 2));
			}
			return;
		}
		outputBuffer.push({
			message,
			messageType: messageType.Name,
			timestamp: tick(),
		});
	});

	const [injected, injErr] = pcall(() => injectStopListener());
	if (!injected) {
		warn(`[MCP] Failed to inject stop listener: ${injErr}`);
	}

	if (numPlayers !== undefined && mode === "run") {
		const TestService = game.GetService("TestService") as TestService & { NumberOfPlayers: number };
		TestService.NumberOfPlayers = math.clamp(numPlayers, 1, 8);
	}

	task.spawn(() => {
		const [ok, result] = pcall(() => {
			if (mode === "play") {
				return StudioTestService.ExecutePlayModeAsync({});
			}
			return StudioTestService.ExecuteRunModeAsync({});
		});

		if (ok) {
			testResult = result;
		} else {
			testError = tostring(result);
		}

		if (logConnection) {
			logConnection.Disconnect();
			logConnection = undefined;
		}
		testRunning = false;

		cleanupStopListener();
	});

	const msg = numPlayers !== undefined
		? `Playtest started in ${mode} mode with ${numPlayers} player(s)`
		: `Playtest started in ${mode} mode`;
	return { success: true, message: msg };
}

// testRunning flips false only when ExecuteRunModeAsync/ExecutePlayModeAsync returns, so it is
// the one trustworthy "the test really ended" signal the edit peer has.
function waitForTestEnd(timeoutSeconds: number): boolean {
	const deadline = os.clock() + timeoutSeconds;
	while (testRunning && os.clock() < deadline) task.wait(0.2);
	return !testRunning;
}

// Runs in the play SERVER copy of the plugin: EndTest only works from that DataModel
// (StudioTestService docs; calling it from edit errors). The MCP server reaches this copy
// directly over the bridge, the same way eval_server_runtime does.
function endTest(_requestData: Record<string, unknown>) {
	if (!RunService.IsRunning() || !RunService.IsServer()) {
		return { error: "end-test must be sent to the play server peer" };
	}
	const service = StudioTestService as unknown as Instance & { EndTest(reason: string): void };
	const [ok, err] = pcall(() => service.EndTest("stopped_by_mcp"));
	return ok ? { success: true } : { error: `EndTest failed: ${tostring(err)}` };
}

// Runs in the edit copy after the MCP server has asked the play server to end the test.
// testRunning flips false only when ExecuteRunModeAsync/ExecutePlayModeAsync returns, so it
// is the edit side's one trustworthy "the test really ended" signal.
function stopPlaytest(requestData: Record<string, unknown>) {
	const endRequested = requestData.endRequested === true;
	const output = [...outputBuffer];
	if (!testRunning) {
		// The play server usually finishes EndTest before this runs, so "not running" after an
		// accepted end request means it stopped, whoever started it.
		return endRequested
			? { success: true, stopped: true, output, outputCount: output.size(), message: "Playtest stopped." }
			: { success: false, stopped: false, output, outputCount: output.size(), error: "No playtest server answered, and none was started by the MCP. Nothing to stop, or press Stop in Studio." };
	}
	if (waitForTestEnd(STOP_CONFIRM_SECONDS)) {
		return { success: true, stopped: true, output, outputCount: output.size(), message: "Playtest stopped." };
	}
	return {
		success: false,
		stopped: false,
		output,
		outputCount: output.size(),
		error: endRequested
			? "The play server accepted the stop but the test has not ended yet. Press Stop in Studio if it stays up."
			: "The play server did not answer the stop. It is likely paused at a breakpoint or hung. Press Stop in Studio.",
	};
}

function getPlaytestOutput(_requestData: Record<string, unknown>) {
	return {
		isRunning: testRunning,
		output: [...outputBuffer],
		outputCount: outputBuffer.size(),
		testResult: testResult !== undefined ? tostring(testResult) : undefined,
		testError,
	};
}

function characterNavigation(requestData: Record<string, unknown>) {
	if (!testRunning) {
		return { error: "Playtest must be running. Start a playtest in 'play' mode first." };
	}

	const position = requestData.position as number[] | undefined;
	const instancePath = requestData.instancePath as string | undefined;
	const waitForCompletion = (requestData.waitForCompletion as boolean) ?? true;
	const timeout = (requestData.timeout as number) ?? 25;

	if (!position && !instancePath) {
		return { error: "Either position [x, y, z] or instancePath is required" };
	}

	let navData: string;
	if (position) {
		navData = HttpService.JSONEncode({ x: position[0], y: position[1], z: position[2] });
	} else {
		navData = HttpService.JSONEncode({ instancePath });
	}

	warn(`${NAV_SIGNAL}:${navData}`);

	if (!waitForCompletion) {
		return { success: true, message: "Navigation command sent" };
	}

	let result: string | undefined;
	navResultCallback = (json: string) => {
		result = json;
	};

	const startTime = tick();
	while (!result && tick() - startTime < timeout) {
		task.wait(0.2);
	}
	navResultCallback = undefined;

	if (result) {
		const [ok, parsed] = pcall(() => HttpService.JSONDecode(result!));
		if (ok) return parsed;
		return { success: true, rawResult: result };
	}
	return { error: `Navigation timed out after ${timeout} seconds` };
}

export = {
	startPlaytest,
	stopPlaytest,
	endTest,
	getPlaytestOutput,
	characterNavigation,
};
