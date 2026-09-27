import { ProxyBridgeService } from '../proxy-bridge-service.js';

describe('ProxyBridgeService instance polling', () => {
  const realFetch = global.fetch;
  let calls: number;

  beforeEach(() => {
    jest.useFakeTimers();
    calls = 0;
    global.fetch = jest.fn(async () => {
      calls++;
      return { ok: true, json: async () => ({ instances: [] }) } as any;
    }) as any;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = realFetch;
  });

  test('dispose stops the /instances poll', () => {
    const bridge = new ProxyBridgeService('http://localhost:58741');
    jest.advanceTimersByTime(6000);
    const whileAlive = calls;
    expect(whileAlive).toBeGreaterThan(0);

    bridge.dispose();
    jest.advanceTimersByTime(20000);
    expect(calls).toBe(whileAlive);
  });

  /**
   * The promotion retry loop used to build a replacement ProxyBridgeService on every
   * failed attempt. Each one started its own 2s poller that nobody cleared, so the poll
   * rate grew without bound and eventually exhausted the machine's ephemeral ports.
   */
  test('disposed bridges do not compound the poll rate', () => {
    const kept = new ProxyBridgeService('http://localhost:58741');
    jest.advanceTimersByTime(4000);
    const baseline = calls;

    for (let i = 0; i < 20; i++) {
      const discarded = new ProxyBridgeService('http://localhost:58741');
      discarded.dispose();
    }

    calls = 0;
    jest.advanceTimersByTime(4000);
    expect(calls).toBeLessThanOrEqual(baseline);

    kept.dispose();
  });
});

describe('ambiguous target guard on the proxy transport', () => {
  /**
   * The base class guard is bypassed entirely by ProxyBridgeService, which overrides
   * sendRequest. A second MCP client always becomes a proxy, so that is the normal
   * path, not the rare one -- and it is the path that answered from the wrong place
   * twice before this existed.
   */
  it('refuses before forwarding when two Studios share a role', async () => {
    const proxy = new ProxyBridgeService('http://localhost:1');
    (proxy as any).cachedInstances = [
      { instanceId: 'aaa', role: 'edit', lastActivity: 0, connectedAt: 0 },
      { instanceId: 'bbb', role: 'edit', lastActivity: 0, connectedAt: 0 },
    ];
    await expect(proxy.sendRequest('/test', {}, 'edit')).rejects.toThrow(
      /2 Studios are connected as "edit" and none is selected/
    );
  });

  it('lets a pinned request through to the transport', async () => {
    const proxy = new ProxyBridgeService('http://localhost:1');
    (proxy as any).cachedInstances = [
      { instanceId: 'aaa', role: 'edit', lastActivity: 0, connectedAt: 0 },
      { instanceId: 'bbb', role: 'edit', lastActivity: 0, connectedAt: 0 },
    ];
    proxy.setPreferredInstance('aaa');
    // Reaches fetch and fails on the dead port -- which proves the guard did not stop it.
    await expect(proxy.sendRequest('/test', {}, 'edit')).rejects.not.toThrow(
      /none is selected/
    );
  });
});
