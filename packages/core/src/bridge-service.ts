import { v4 as uuidv4 } from 'uuid';

export interface PluginInstance {
  instanceId: string;
  role: string;
  lastActivity: number;
  connectedAt: number;
}

interface PendingRequest {
  id: string;
  endpoint: string;
  data: any;
  target: string;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  // Pinned to ONE instance by the caller. The preferred-instance field below is global
  // to a server, which is wrong the moment several MCP clients share one bridge: client
  // A choosing a Studio would silently retarget client B. A pin travels WITH the request,
  // so each client can aim at its own Studio and they cannot fight over it.
  targetInstanceId?: string;
  // Which instance was handed this request. Requests are targeted by ROLE, and every
  // Studio opened in edit mode registers as 'edit' -- so with two places open, both
  // poll for the same role and used to receive the SAME request. Both executed it: one
  // applied the write, the other answered "Instance not found", and whichever response
  // arrived first won. A caller seeing the error would retry, appending another copy of
  // the edit each time. Claiming on handout is what makes a request single-delivery.
  claimedBy?: string;
}

const STALE_INSTANCE_MS = 30000;

export class BridgeService {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private instances: Map<string, PluginInstance> = new Map();
  private nextClientIndex = 1;
  private requestTimeout = 30000;
  // Which instance should win when several share a role. Every Studio opened in edit
  // mode registers as 'edit', so with two places open a request targeted at 'edit' went
  // to whichever polled first -- a coin flip per call, and set_active_studio could not
  // change it because it only ever stored a role, which was already ambiguous.
  private preferredInstanceId: string | null = null;
  // Monotonic counter bumped each time a Studio successfully delivers a response.
  // Consumers (e.g. proxy stale-primary detection) poll /health and watch this advance.
  private livenessNonce = 0;

  getLivenessNonce(): number {
    return this.livenessNonce;
  }

  bumpLivenessNonce(): number {
    this.livenessNonce += 1;
    return this.livenessNonce;
  }

  registerInstance(instanceId: string, role: string): string {
    let assignedRole = role;
    if (role === 'client') {
      assignedRole = `client-${this.nextClientIndex}`;
      this.nextClientIndex++;
    }

    this.instances.set(instanceId, {
      instanceId,
      role: assignedRole,
      lastActivity: Date.now(),
      connectedAt: Date.now(),
    });

    return assignedRole;
  }

  unregisterInstance(instanceId: string) {
    this.instances.delete(instanceId);
    if (this.preferredInstanceId === instanceId) {
      this.preferredInstanceId = null;
    }

    for (const [id, req] of this.pendingRequests.entries()) {
      const targetRole = req.target;
      const hasHandler = Array.from(this.instances.values()).some(i => i.role === targetRole);
      if (!hasHandler) {
        clearTimeout(req.timeoutId);
        this.pendingRequests.delete(id);
        req.reject(new Error(`Target instance "${targetRole}" disconnected`));
      } else if (req.claimedBy === instanceId) {
        // It held a claim and went away without answering. Release it so a surviving
        // instance on the same role can pick it up, rather than letting it sit until
        // the request timeout fires.
        req.claimedBy = undefined;
      }
    }
  }

  getInstances(): PluginInstance[] {
    return Array.from(this.instances.values());
  }

  setPreferredInstance(instanceId: string | null) {
    this.preferredInstanceId = instanceId;
  }

  getPreferredInstance(): string | null {
    return this.preferredInstanceId;
  }

  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  updateInstanceActivity(instanceId: string) {
    const inst = this.instances.get(instanceId);
    if (inst) {
      inst.lastActivity = Date.now();
    }
  }

  cleanupStaleInstances() {
    const now = Date.now();
    for (const [id, inst] of this.instances.entries()) {
      if (now - inst.lastActivity > STALE_INSTANCE_MS) {
        this.unregisterInstance(id);
      }
    }
  }

  async sendRequest(endpoint: string, data: any, target = 'edit', targetInstanceId?: string): Promise<any> {
    const requestId = uuidv4();

    return new Promise((resolve, reject) => {

      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, this.requestTimeout);

      const request: PendingRequest = {
        id: requestId,
        endpoint,
        data,
        target,
        targetInstanceId,
        timestamp: Date.now(),
        resolve,
        reject,
        timeoutId
      };

      this.pendingRequests.set(requestId, request);
    });
  }

  getPendingRequest(callerRole = 'edit', callerInstanceId?: string): { requestId: string; request: { endpoint: string; data: any } } | null {

    let oldestRequest: PendingRequest | null = null;

    // A preferred instance only excludes OTHERS ON ITS OWN ROLE. A preference for an
    // edit place must not starve a client-1 poller, and a preference for an instance
    // that has since disconnected must not stall every request.
    const preferred = this.preferredInstanceId
      ? this.instances.get(this.preferredInstanceId)
      : undefined;

    for (const request of this.pendingRequests.values()) {
      if (request.target !== callerRole) continue;
      // A pin beats the server-wide preference: it is the caller naming its own Studio,
      // and with several MCP clients on one bridge that is the only answer that can be
      // right for all of them.
      if (request.targetInstanceId) {
        if (request.targetInstanceId !== callerInstanceId) continue;
      } else if (preferred && preferred.role === callerRole
        && callerInstanceId !== preferred.instanceId) continue;
      // Already handed out. Skipping is the whole fix: without it every instance
      // sharing this role executes the same request.
      //
      // An IDENTIFIED caller may re-poll its own claim, so a dropped response is
      // recoverable. An anonymous caller may not touch a claimed request at all --
      // two anonymous pollers would otherwise both match the same sentinel and the
      // bug would survive the fix.
      if (request.claimedBy !== undefined) {
        if (!callerInstanceId || request.claimedBy !== callerInstanceId) continue;
      }
      if (!oldestRequest || request.timestamp < oldestRequest.timestamp) {
        oldestRequest = request;
      }
    }

    if (oldestRequest) {
      // Claim before handing it out. The sentinel is only so an anonymous poller marks
      // the request as taken at all -- the skip above is what keeps a second poller off
      // it, identified or not.
      oldestRequest.claimedBy = callerInstanceId ?? 'anonymous';
      return {
        requestId: oldestRequest.id,
        request: {
          endpoint: oldestRequest.endpoint,
          data: oldestRequest.data
        }
      };
    }

    return null;
  }

  resolveRequest(requestId: string, response: any) {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      clearTimeout(request.timeoutId);
      this.pendingRequests.delete(requestId);
      request.resolve(response);
    }
  }

  rejectRequest(requestId: string, error: any) {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      clearTimeout(request.timeoutId);
      this.pendingRequests.delete(requestId);
      request.reject(error);
    }
  }

  cleanupOldRequests() {
    const now = Date.now();
    for (const [id, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.requestTimeout) {
        clearTimeout(request.timeoutId);
        this.pendingRequests.delete(id);
        request.reject(new Error('Request timeout'));
      }
    }
  }

  clearAllPendingRequests() {
    for (const [, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeoutId);
      request.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }
}