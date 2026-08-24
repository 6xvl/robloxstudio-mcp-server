// Multiplayer Studio testing, ported from Chrrxs/robloxstudio-mcp (MIT).
// Kept out of TestHandlers so our solo playtest path stays untouched: this drives
// StudioTestService.ExecuteMultiplayerTestAsync, which is a different mechanism.

import { HttpService, Players, RunService } from "@rbxts/services";
import StopPlayMonitor from "../StopPlayMonitor";

interface StudioTestServiceMultiplayer extends StudioTestService {
	ExecuteMultiplayerTestAsync(numPlayers: number, testArgs: unknown): unknown;
	AddPlayers(numPlayers: number): void;
	CanLeaveTest(): boolean;
	LeaveTest(): void;
	EditModeActive: boolean;
}

const StudioTestService = game.GetService("StudioTestService") as StudioTestServiceMultiplayer;

let testRunning = false;

type MultiplayerPhase = "idle" | "starting" | "running" | "completed" | "failed";

interface MultiplayerSessionState {
	phase: MultiplayerPhase;
	testId?: string;
	numPlayers?: number;
	testArgs?: unknown;
	startedAt?: number;
	completedAt?: number;
	ok?: boolean;
	result?: unknown;
	error?: string;
}

let multiplayerState: MultiplayerSessionState = { phase: "idle" };

function detectPeerRole(): string {
	if (!RunService.IsRunning()) return "edit";
	if (RunService.IsServer()) return "server";
	return "client";
}

function getPlayersSnapshot() {
	const players = Players.GetPlayers().map((player) => ({
		name: player.Name,
		userId: player.UserId,
		displayName: player.DisplayName,
	}));
	players.sort((a, b) => a.name < b.name);
	return players;
}

function cloneMultiplayerState(): MultiplayerSessionState {
	return {
		phase: multiplayerState.phase,
		testId: multiplayerState.testId,
		numPlayers: multiplayerState.numPlayers,
		testArgs: multiplayerState.testArgs,
		startedAt: multiplayerState.startedAt,
		completedAt: multiplayerState.completedAt,
		ok: multiplayerState.ok,
		result: multiplayerState.result,
		error: multiplayerState.error,
	};
}

function normalizeNumPlayers(value: unknown): number | undefined {
	if (!typeIs(value, "number")) return undefined;
	const n = math.floor(value);
	if (n !== value || n < 1 || n > 8) return undefined;
	return n;
}

function multiplayerTestStart(requestData: Record<string, unknown>) {
	if (RunService.IsRunning()) {
		return { error: "multiplayer_test_start must be called on the edit DataModel. Route with target=edit." };
	}

	const numPlayers = normalizeNumPlayers(requestData.numPlayers);
	if (numPlayers === undefined) {
		return { error: "numPlayers must be an integer from 1 to 8" };
	}

	if (multiplayerState.phase === "starting" || multiplayerState.phase === "running") {
		return {
			error: "A multiplayer Studio test is already running",
			state: cloneMultiplayerState(),
		};
	}

	const testArgs = requestData.testArgs !== undefined ? requestData.testArgs : {};
	const testId = HttpService.GenerateGUID(false);

	multiplayerState = {
		phase: "starting",
		testId,
		numPlayers,
		testArgs,
		startedAt: tick(),
	};

	task.spawn(() => {
		multiplayerState.phase = "running";
		const [ok, result] = pcall(() => {
			return StudioTestService.ExecuteMultiplayerTestAsync(numPlayers, testArgs);
		});

		multiplayerState.completedAt = tick();
		multiplayerState.ok = ok;
		if (ok) {
			multiplayerState.phase = "completed";
			multiplayerState.result = result;
			multiplayerState.error = undefined;
		} else {
			multiplayerState.phase = "failed";
			multiplayerState.result = undefined;
			multiplayerState.error = tostring(result);
		}
	});

	const response: Record<string, unknown> = {
		success: true,
		message: `Multiplayer Studio test starting with ${numPlayers} player(s).`,
		testId,
		phase: multiplayerState.phase,
		numPlayers,
		testArgs,
	};
	return response;
}

function multiplayerTestState(_requestData: Record<string, unknown>) {
	const peer = detectPeerRole();
	const response: Record<string, unknown> = {
		success: true,
		peer,
		isRunning: RunService.IsRunning(),
		isRunMode: RunService.IsRunMode(),
		editModeActive: StudioTestService.EditModeActive,
	};

	if (peer === "edit") {
		response.session = cloneMultiplayerState();
		return response;
	}

	const [argsOk, args] = pcall(() => StudioTestService.GetTestArgs());
	response.testArgsOk = argsOk;
	response.testArgs = argsOk ? args : undefined;
	if (!argsOk) response.testArgsError = tostring(args);

	const players = getPlayersSnapshot();
	response.players = players;
	response.playerCount = players.size();

	if (peer === "client") {
		response.localPlayer = Players.LocalPlayer ? Players.LocalPlayer.Name : undefined;
		const [canLeaveOk, canLeave] = pcall(() => StudioTestService.CanLeaveTest());
		response.canLeaveOk = canLeaveOk;
		response.canLeave = canLeaveOk ? canLeave : false;
		if (!canLeaveOk) response.canLeaveError = tostring(canLeave);
	}

	return response;
}

function multiplayerTestAddPlayers(requestData: Record<string, unknown>) {
	if (!RunService.IsRunning() || !RunService.IsServer()) {
		return { error: "multiplayer_test_add_players must be called on the running server peer. Route with target=server." };
	}
	const numPlayers = normalizeNumPlayers(requestData.numPlayers);
	if (numPlayers === undefined) {
		return { error: "numPlayers must be an integer from 1 to 8" };
	}

	const before = Players.GetPlayers().size();
	const [ok, result] = pcall(() => StudioTestService.AddPlayers(numPlayers));
	if (!ok) {
		return { error: tostring(result) };
	}

	const deadline = tick() + ((requestData.timeout as number | undefined) ?? 10);
	while (Players.GetPlayers().size() < before + numPlayers && tick() < deadline) {
		task.wait(0.1);
	}

	const players = getPlayersSnapshot();
	return {
		success: true,
		message: `Requested ${numPlayers} additional player(s).`,
		playerCount: players.size(),
		players,
	};
}

function multiplayerTestLeaveClient(_requestData: Record<string, unknown>) {
	if (!RunService.IsRunning() || RunService.IsServer()) {
		return { error: "multiplayer_test_leave_client must be called on a running client peer. Route with target=client-N." };
	}

	const [canLeaveOk, canLeave] = pcall(() => StudioTestService.CanLeaveTest());
	if (!canLeaveOk) {
		return { error: tostring(canLeave), canLeaveOk: false };
	}
	if (!canLeave) {
		return { error: "This client cannot leave the current test session.", canLeaveOk: true, canLeave: false };
	}

	const localPlayer = Players.LocalPlayer ? Players.LocalPlayer.Name : undefined;
	task.defer(() => {
		pcall(() => StudioTestService.LeaveTest());
	});
	return {
		success: true,
		message: "Client leave requested.",
		localPlayer,
	};
}

function multiplayerTestEnd(requestData: Record<string, unknown>) {
	if (!RunService.IsRunning() || !RunService.IsServer()) {
		return { error: "multiplayer_test_end must be called on the running server peer. Route with target=server." };
	}

	const value = requestData.value !== undefined ? requestData.value : "ended_by_mcp";
	const [ok, result] = pcall(() => StudioTestService.EndTest(value));
	if (!ok) {
		return { error: tostring(result) };
	}
	return {
		success: true,
		message: "Multiplayer Studio test end requested.",
		value,
	};
}

export = {
	multiplayerTestStart,
	multiplayerTestState,
	multiplayerTestAddPlayers,
	multiplayerTestLeaveClient,
	multiplayerTestEnd,
};
