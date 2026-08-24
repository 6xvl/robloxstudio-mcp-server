import Utils from "../Utils";

const Selection = game.GetService("Selection");

const { getInstancePath, getInstanceByPath } = Utils;

// Selection and viewport framing, ported from Chrrxs/robloxstudio-mcp (MIT). Upstream keeps
// these in MetadataHandlers; they live apart here so our copy of that file stays ours.

function setSelection(requestData: Record<string, unknown>) {
	const rawPaths = requestData.paths;
	if (!typeIs(rawPaths, "table")) {
		return { error: "paths is required (an empty array clears in set mode)" };
	}

	const mode = (requestData.mode as string) ?? "set";
	if (mode !== "set" && mode !== "add" && mode !== "remove") {
		return { error: `mode must be "set", "add" or "remove" (got: ${mode})` };
	}

	const paths = rawPaths as unknown[];
	if (paths.size() === 0 && mode !== "set") {
		return { error: `paths cannot be empty in ${mode} mode` };
	}

	const targets: Instance[] = [];
	const missing: string[] = [];
	for (const entry of paths) {
		if (!typeIs(entry, "string") || entry === "") {
			return { error: "paths must contain non-empty instance path strings" };
		}
		const instance = getInstanceByPath(entry);
		if (instance) {
			targets.push(instance);
		} else {
			missing.push(entry);
		}
	}

	const clearsSelection = mode === "set" && paths.size() === 0;
	if (targets.size() === 0 && !clearsSelection) {
		return { error: "No matching instances found for any path", missingPaths: missing };
	}

	const [ok, err] = pcall(() => {
		if (mode === "add") {
			Selection.Add(targets);
		} else if (mode === "remove") {
			Selection.Remove(targets);
		} else {
			Selection.Set(targets);
		}
	});

	if (!ok) return { error: `Selection.${mode} failed: ${tostring(err)}` };

	return {
		success: true,
		mode,
		selected: targets.size(),
		missingPaths: missing,
		message:
			clearsSelection
				? "Selection cleared"
				: mode === "remove"
					? `Deselected ${targets.size()} object(s)`
					: `${targets.size()} object(s) ${mode === "add" ? "added to" : "in"} the selection`,
	};
}

function focusViewport(requestData: Record<string, unknown>) {
	const instancePath = requestData.path as string;
	if (!instancePath) return { error: "path is required (the instance to frame)" };

	const instance = getInstanceByPath(instancePath);
	if (!instance) return { error: `Instance not found: ${instancePath}` };

	const workspace = game.GetService("Workspace");
	const camera = workspace.CurrentCamera;
	if (!camera) return { error: "Workspace.CurrentCamera is unavailable right now" };

	const padding = tonumber(requestData.padding as number) ?? 1;
	if (padding <= 0 || padding > 10) {
		return { error: "padding must be greater than 0 and at most 10" };
	}

	const compassOverride =
		requestData.from === undefined ? undefined : tonumber(requestData.from as number);
	if (requestData.from !== undefined && compassOverride === undefined) {
		return { error: "from must be a compass angle in degrees" };
	}

	const elevationOverride =
		requestData.angleY === undefined ? undefined : tonumber(requestData.angleY as number);
	if (
		requestData.angleY !== undefined &&
		(elevationOverride === undefined || elevationOverride < -89 || elevationOverride > 89)
	) {
		return { error: "angleY must be between -89 and 89" };
	}

	const [ok, err] = pcall(() => {
		let boundsCF: CFrame;
		let boundsSize: Vector3;
		if (instance.IsA("Model")) {
			[boundsCF, boundsSize] = instance.GetBoundingBox();
		} else if (instance.IsA("BasePart")) {
			boundsCF = instance.CFrame;
			boundsSize = instance.Size;
		} else {
			return error(
				`Cannot frame a ${instance.ClassName}: it has no 3D bounding box. Frame a part or model instead.`
			);
		}

		const center = boundsCF.Position;
		let direction = camera.CFrame.LookVector.mul(-1);

		const currentHorizontal = new Vector3(direction.X, 0, direction.Z);
		let horizontalDirection =
			currentHorizontal.Magnitude < 0.001 ? new Vector3(1, 0, 0) : currentHorizontal.Unit;
		if (compassOverride !== undefined) {
			const yaw = math.rad(compassOverride);
			horizontalDirection = new Vector3(math.cos(yaw), 0, math.sin(yaw));
		}

		let vertical = direction.Y;
		let horizontalMagnitude = math.sqrt(math.max(0, 1 - vertical * vertical));
		if (elevationOverride !== undefined) {
			const pitch = math.rad(elevationOverride);
			vertical = math.sin(pitch);
			horizontalMagnitude = math.cos(pitch);
		}
		direction = horizontalDirection
			.mul(horizontalMagnitude)
			.add(new Vector3(0, vertical, 0))
			.Unit;

		camera.CameraType = Enum.CameraType.Scriptable;
		camera.CFrame = CFrame.lookAt(center.add(direction.mul(math.max(boundsSize.Magnitude, 1))), center);
		camera.Focus = new CFrame(center);
		camera.ZoomToExtents(boundsCF, boundsSize);

		if (padding !== 1) {
			const fittedOffset = camera.CFrame.Position.sub(center);
			camera.CFrame = CFrame.lookAt(center.add(fittedOffset.mul(padding)), center);
		}
		camera.Focus = new CFrame(center);
	});

	if (!ok) return { error: `focus failed: ${tostring(err)}` };

	return {
		success: true,
		path: getInstancePath(instance),
		cameraPosition: {
			X: camera.CFrame.Position.X,
			Y: camera.CFrame.Position.Y,
			Z: camera.CFrame.Position.Z,
		},
	};
}

export = {
	setSelection,
	focusViewport,
};
