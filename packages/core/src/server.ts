import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import { createHttpServer, listenWithRetry, TOOL_HANDLERS } from './http-server.js';
import { RobloxStudioTools } from './tools/index.js';
import { BridgeService } from './bridge-service.js';
import { ProxyBridgeService } from './proxy-bridge-service.js';
import type { ToolDefinition } from './tools/definitions.js';
import { RobloxOfficialMCPClient } from './roblox-mcp-client.js';

export interface ServerConfig {
  name: string;
  version: string;
  tools: ToolDefinition[];
}

export class RobloxStudioMCPServer {
  private server: Server;
  private tools: RobloxStudioTools;
  private bridge: BridgeService;
  private allowedToolNames: Set<string>;
  private config: ServerConfig;
  private robloxHook: RobloxOfficialMCPClient | null = null;
  private mergedTools: ToolDefinition[] = [];
  // Per-Claude active-studio map (keyed by MCP session id when available; otherwise '_default')
  private activeStudioByClient: Map<string, string> = new Map();

  constructor(config: ServerConfig) {
    this.config = config;
    this.allowedToolNames = new Set(config.tools.map(t => t.name));
    this.mergedTools = [...config.tools];

    // Auto-enable Roblox MCP hook if mcp.bat exists or env var set
    const hookEnabled = process.env.ROBLOX_MCP_HOOK !== '0' &&
      (process.env.ROBLOX_MCP_HOOK === '1' || !!RobloxOfficialMCPClient.autoLocate());
    if (hookEnabled) {
      const batPath = process.env.ROBLOX_MCP_BAT || RobloxOfficialMCPClient.autoLocate();
      if (batPath) {
        this.robloxHook = new RobloxOfficialMCPClient(batPath);
      }
    }

    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.bridge = new BridgeService();
    this.tools = new RobloxStudioTools(this.bridge);
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const ours = this.config.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      // Multi-Studio routing tools (built-in)
      const routingTools = [
        {
          name: 'list_studios',
          description: 'List connected Roblox Studio plugin instances. Returns roles, instance IDs, last activity. Use to pick a target with set_active_studio.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'set_active_studio',
          description: 'Set the active Studio target for subsequent tool calls in this Claude session. Pass role (e.g. "client-1") or instanceId from list_studios.',
          inputSchema: {
            type: 'object',
            properties: { target: { type: 'string', description: 'Studio role or instanceId' } },
            required: ['target'],
          },
        },
      ];
      const hookTools = this.robloxHook?.isConnected() ? this.robloxHook.getTools() : [];
      return { tools: [...ours, ...routingTools, ...hookTools] };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // 1. Roblox official MCP forwarding
      const robloxName = RobloxOfficialMCPClient.stripPrefix(name);
      if (robloxName && this.robloxHook?.isConnected()) {
        try {
          return await this.robloxHook.callTool(robloxName, args ?? {});
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Roblox official MCP call failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // 2. Built-in routing tools
      if (name === 'list_studios') {
        const instances = this.bridge.getInstances();
        return {
          content: [{ type: 'text', text: JSON.stringify({
            studios: instances,
            active: this.activeStudioByClient.get('_default') || null,
          }) }],
        };
      }
      if (name === 'set_active_studio') {
        const target = (args as any)?.target;
        if (!target) throw new McpError(ErrorCode.InvalidParams, 'target is required');
        const instances = this.bridge.getInstances();
        const match = instances.find(i => i.instanceId === target || i.role === target);
        if (!match) {
          return { content: [{ type: 'text', text: JSON.stringify({
            success: false,
            error: `Studio '${target}' not found`,
            availableStudios: instances.map(i => ({ instanceId: i.instanceId, role: i.role })),
          }) }] };
        }
        this.activeStudioByClient.set('_default', match.role);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, active: match.role, instanceId: match.instanceId }) }] };
      }

      // 3. Our own tools
      if (!this.allowedToolNames.has(name)) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      const handler = TOOL_HANDLERS[name];
      if (!handler) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      try {
        return await handler(this.tools, args ?? {});
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async run() {
    const basePort = process.env.ROBLOX_STUDIO_PORT ? parseInt(process.env.ROBLOX_STUDIO_PORT) : 58741;
    const host = process.env.ROBLOX_STUDIO_HOST || '0.0.0.0';
    let bridgeMode: 'primary' | 'proxy' = 'primary';
    let httpHandle: http.Server | undefined;
    let primaryApp: ReturnType<typeof createHttpServer> | undefined;
    let boundPort = 0;
    let promotionInterval: ReturnType<typeof setInterval> | undefined;

    const buildHttpConfig = () => ({
      ...this.config,
      robloxHook: this.robloxHook,
      activeStudioMap: this.activeStudioByClient,
    });

    // Try to bind as primary
    try {
      primaryApp = createHttpServer(this.tools, this.bridge, this.allowedToolNames, buildHttpConfig());
      const result = await listenWithRetry(primaryApp, host, basePort, 5);
      httpHandle = result.server;
      boundPort = result.port;
      console.error(`HTTP server listening on ${host}:${boundPort} for Studio plugin (primary mode)`);
      console.error(`Streamable HTTP MCP endpoint: http://localhost:${boundPort}/mcp`);
    } catch (err) {
      // All ports in use — fall back to proxy mode
      console.error(`Could not bind primary HTTP server: ${(err as Error).message}`);
      bridgeMode = 'proxy';
      primaryApp = undefined;
      const proxyBridge = new ProxyBridgeService(`http://localhost:${basePort}`);
      this.bridge = proxyBridge;
      this.tools = new RobloxStudioTools(this.bridge);
      console.error(`All ports ${basePort}-${basePort + 4} in use — entering proxy mode (forwarding to localhost:${basePort})`);

      // Periodically try to promote to primary if the port frees up
      // TODO: also poll primary /health.livenessNonce — if it hasn't advanced
      // in >60s AND mcpServerActive=true, force-demote primary and bind here.
      const promotionIntervalMs = parseInt(process.env.ROBLOX_STUDIO_PROXY_PROMOTION_INTERVAL_MS || '5000');
      promotionInterval = setInterval(async () => {
        try {
          this.bridge = new BridgeService();
          this.tools = new RobloxStudioTools(this.bridge);
          primaryApp = createHttpServer(this.tools, this.bridge, this.allowedToolNames, buildHttpConfig());
          const result = await listenWithRetry(primaryApp, host, basePort, 5);
          httpHandle = result.server;
          boundPort = result.port;
          bridgeMode = 'primary';
          (primaryApp as any).setMCPServerActive(true);
          console.error(`Promoted from proxy to primary on port ${boundPort}`);
          if (promotionInterval) clearInterval(promotionInterval);
        } catch {
          // Still can't bind — stay in proxy mode, restore proxy bridge
          this.bridge = new ProxyBridgeService(`http://localhost:${basePort}`);
          this.tools = new RobloxStudioTools(this.bridge);
          primaryApp = undefined;
        }
      }, promotionIntervalMs);
    }

    // Legacy port 3002 for old plugins
    const LEGACY_PORT = 3002;
    let legacyHandle: http.Server | undefined;
    let legacyApp: ReturnType<typeof createHttpServer> | undefined;
    if (boundPort !== LEGACY_PORT && bridgeMode === 'primary') {
      legacyApp = createHttpServer(this.tools, this.bridge, this.allowedToolNames, buildHttpConfig());
      try {
        const result = await listenWithRetry(legacyApp, host, LEGACY_PORT, 1);
        legacyHandle = result.server;
        console.error(`Legacy HTTP server also listening on ${host}:${LEGACY_PORT} for old plugins`);
        (legacyApp as any).setMCPServerActive(true);
      } catch {
        console.error(`Legacy port ${LEGACY_PORT} in use, skipping backward-compat listener`);
      }
    }

    // Optional: connect to Roblox official MCP for tool aggregation.
    // Await with a short cap so the catalog is fully merged before stdio transport accepts ListTools.
    // If the hook never finishes within the cap, continue without it; catalog drift is bounded.
    if (this.robloxHook) {
      const hookConnectTimeoutMs = parseInt(process.env.ROBLOX_MCP_HOOK_TIMEOUT_MS || '5000');
      const hookConnect = this.robloxHook.connect();
      await Promise.race([
        hookConnect.catch(err => {
          console.error(`[roblox-hook] connect failed (non-fatal): ${err.message}`);
        }),
        new Promise(resolve => setTimeout(resolve, hookConnectTimeoutMs)),
      ]);
      // If it's still pending, attach a deferred handler so catalog updates when it finally connects
      hookConnect.then(() => {
        if (this.robloxHook?.isConnected()) {
          console.error(`[roblox-hook] catalog now includes Roblox official tools`);
          // Tool catalog changed after initial handshake — tell the client to refresh.
          try {
            void this.server.sendToolListChanged();
          } catch {}
        }
      }).catch(() => {});
    }

    // Best-effort shutdown of the hook child on process exit so StudioMCP.exe is not orphaned.
    const cleanup = async () => {
      try { await this.robloxHook?.disconnect(); } catch {}
    };
    process.once('exit', () => { void cleanup(); });
    process.once('SIGINT', () => { void cleanup().then(() => process.exit(0)); });
    process.once('SIGTERM', () => { void cleanup().then(() => process.exit(0)); });

    // Start stdio MCP transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`${this.config.name} v${this.config.version} running on stdio`);

    if (primaryApp) {
      (primaryApp as any).setMCPServerActive(true);
    }

    console.error(bridgeMode === 'primary'
      ? 'MCP server marked as active (primary mode)'
      : 'MCP server active in proxy mode — forwarding requests to primary');

    console.error('Waiting for Studio plugin to connect...');

    let routeDriftChecked = false;
    const performRouteDriftCheck = async () => {
      try {
        const resp: any = await this.bridge.sendRequest('/api/list-endpoints', {}, 'edit');
        const advertisedEndpoints = new Set<string>(resp?.endpoints || []);
        const REQUIRED_ENDPOINTS = [
          '/api/file-tree', '/api/place-info', '/api/services', '/api/instance-properties',
          '/api/instance-children', '/api/search-by-property', '/api/class-info',
          '/api/set-property', '/api/set-properties', '/api/create-object', '/api/delete-object',
          '/api/get-script-source', '/api/set-script-source', '/api/edit-script-lines',
          '/api/grep-scripts', '/api/execute-luau', '/api/get-selection',
          '/api/terrain-fill-block', '/api/terrain-clear',
          '/api/lighting-set-preset', '/api/lighting-get',
          '/api/health', '/api/diff-subtree', '/api/profile-snapshot',
          '/api/animation-play', '/api/particle-create', '/api/sound-play-preview',
          '/api/tween-preview', '/api/textchat-configure', '/api/material-list-variants',
          '/api/capture-screenshot', '/api/compare-instances', '/api/get-output-log',
        ];
        const missing = REQUIRED_ENDPOINTS.filter(e => !advertisedEndpoints.has(e));
        if (missing.length > 0) {
          console.error(`[route-drift] WARNING: plugin missing ${missing.length} expected endpoints: ${missing.join(', ')}`);
        } else {
          console.error(`[route-drift] OK — plugin has ${advertisedEndpoints.size} endpoints, all required present`);
        }
      } catch (err) {
        console.error(`[route-drift] check failed (non-fatal): ${(err as Error).message}`);
      }
    };

    const activityInterval = setInterval(() => {
      if (primaryApp) (primaryApp as any).trackMCPActivity();
      if (legacyApp) (legacyApp as any).trackMCPActivity();

      if (bridgeMode === 'primary' && primaryApp) {
        const pluginConnected = (primaryApp as any).isPluginConnected();
        const mcpActive = (primaryApp as any).isMCPServerActive();

        if (pluginConnected && mcpActive) {
          if (!routeDriftChecked) {
            routeDriftChecked = true;
            setTimeout(() => { void performRouteDriftCheck(); }, 3000);
          }
        } else if (pluginConnected && !mcpActive) {
          console.error('Studio plugin connected, but MCP server inactive');
        } else if (!pluginConnected && mcpActive) {
          console.error('MCP server active, waiting for Studio plugin...');
        } else {
          console.error('Waiting for connections...');
        }
      }
    }, 5000);

    const cleanupInterval = setInterval(() => {
      this.bridge.cleanupOldRequests();
      this.bridge.cleanupStaleInstances();
    }, 5000);

    const shutdown = async () => {
      console.error('Shutting down MCP server...');
      clearInterval(activityInterval);
      clearInterval(cleanupInterval);
      if (promotionInterval) clearInterval(promotionInterval);
      await this.server.close().catch(() => {});
      if (httpHandle) httpHandle.close();
      if (legacyHandle) legacyHandle.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGHUP', shutdown);

    process.stdin.on('end', shutdown);
    process.stdin.on('close', shutdown);
  }
}
