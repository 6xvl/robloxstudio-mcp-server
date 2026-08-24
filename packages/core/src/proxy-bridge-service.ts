import { BridgeService, type PluginInstance } from './bridge-service.js';
import { v4 as uuidv4 } from 'uuid';

export class ProxyBridgeService extends BridgeService {
  private primaryBaseUrl: string;
  readonly proxyInstanceId: string;
  private proxyRequestTimeout = 30000;

  constructor(primaryBaseUrl: string) {
    super();
    this.primaryBaseUrl = primaryBaseUrl;
    this.proxyInstanceId = uuidv4();

    void this.refreshInstances();
    // unref so a proxy that is otherwise idle does not hold the process open.
    const timer = setInterval(() => void this.refreshInstances(), 2000);
    if (typeof (timer as any).unref === 'function') (timer as any).unref();
  }

  /**
   * A proxy owns no state: the primary holds the instances and the pending queue. Without
   * forwarding this, the second MCP client on the machine saw an empty world --
   * list_studios returned nothing and set_active_studio could not find a Studio that was
   * plainly connected.
   *
   * Cached rather than fetched on call, because the base method is synchronous and every
   * caller relies on that. A couple of seconds stale is fine for a list of open Studios;
   * they do not come and go inside one tool call.
   */
  private cachedInstances: PluginInstance[] = [];

  override getInstances(): PluginInstance[] {
    return this.cachedInstances;
  }

  private async refreshInstances() {
    try {
      const response = await fetch(`${this.primaryBaseUrl}/instances`);
      if (!response.ok) return;
      const body = await response.json() as { instances?: PluginInstance[] };
      this.cachedInstances = body.instances ?? [];
    } catch {
      // Primary is down or restarting. Keeping the last list beats blanking it: the
      // next poll repairs it, and a momentary empty list looks like every Studio closed.
    }
  }

  // Kept LOCAL on purpose. The preference is this client's aim, and pushing it to the
  // primary would repoint every other client sharing the bridge. It reaches the primary
  // as a per-request pin instead -- see targetInstanceId in sendRequest.
  override setPreferredInstance(instanceId: string | null) {
    this.preferred = instanceId;
  }

  override getPreferredInstance(): string | null {
    return this.preferred;
  }

  private preferred: string | null = null;

  override async sendRequest(endpoint: string, data: any, target = 'edit', targetInstanceId?: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.proxyRequestTimeout);

    try {
      const response = await fetch(`${this.primaryBaseUrl}/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          data,
          target,
          // This client's chosen Studio, pinned to the request so the primary hands it
          // to that instance and nobody else's tool call is redirected.
          targetInstanceId: targetInstanceId ?? this.preferred ?? undefined,
          proxyInstanceId: this.proxyInstanceId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Proxy request failed (${response.status}): ${body}`);
      }

      const result = await response.json() as { response?: any; error?: string };
      if (result.error) {
        throw new Error(result.error);
      }
      return result.response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Proxy request timeout');
      }
      throw err;
    }
  }

  override cleanupOldRequests(): void {
    // No-op: primary bridge owns the pending request state
  }

  override clearAllPendingRequests(): void {
    // No-op: primary bridge owns the pending request state
  }
}
