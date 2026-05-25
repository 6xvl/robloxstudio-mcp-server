/**
 * MCP client wrapper that spawns Roblox's official Studio MCP server
 * (cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat) and exposes its tools.
 *
 * Used by RobloxStudioMCPServer to merge tool catalogs and forward calls.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs';
import * as path from 'path';

export interface RobloxMCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export class RobloxOfficialMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private toolsCache: RobloxMCPTool[] = [];
  private connectPromise: Promise<void> | null = null;

  constructor(private mcpBatPath: string) {}

  static autoLocate(): string | null {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) return null;
    const candidate = path.join(localAppData, 'Roblox', 'mcp.bat');
    if (fs.existsSync(candidate)) return candidate;
    return null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      try {
        // Spawn Roblox's MCP via cmd.exe (since mcp.bat is a batch file).
        // stderr: 'pipe' prevents child stderr leaking into our stdout MCP stream.
        this.transport = new StdioClientTransport({
          command: 'cmd.exe',
          args: ['/c', this.mcpBatPath],
          stderr: 'pipe',
        });

        this.client = new Client(
          { name: 'robloxstudio-mcp-hook', version: '1.0.0' },
          { capabilities: {} }
        );

        await this.client.connect(this.transport);

        // Fetch tool list
        const result = await this.client.listTools();
        this.toolsCache = (result.tools || []).map((t: any) => ({
          name: t.name,
          description: t.description || '',
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
        }));

        this.connected = true;
        console.error(`[roblox-hook] Connected to Roblox StudioMCP — ${this.toolsCache.length} tools`);
      } catch (err) {
        console.error(`[roblox-hook] Failed to connect to Roblox StudioMCP: ${(err as Error).message}`);
        this.connected = false;
        this.client = null;
        this.transport = null;
        throw err;
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client?.close();
    } catch {}
    this.connected = false;
    this.client = null;
    this.transport = null;
  }

  getTools(prefix: string = 'rblx_'): RobloxMCPTool[] {
    return this.toolsCache.map(t => ({
      name: prefix + t.name,
      description: `[Roblox official] ${t.description}`,
      inputSchema: t.inputSchema,
    }));
  }

  /**
   * Forward a tool call to Roblox's MCP. Tool name should be the UNPREFIXED name.
   */
  async callTool(name: string, args: any): Promise<any> {
    if (!this.connected || !this.client) {
      throw new Error('Roblox MCP not connected');
    }
    const result = await this.client.callTool({ name, arguments: args });
    return result;
  }

  /**
   * Strip our prefix from a fully-qualified tool name.
   */
  static stripPrefix(name: string, prefix: string = 'rblx_'): string | null {
    if (name.startsWith(prefix)) return name.slice(prefix.length);
    return null;
  }
}
