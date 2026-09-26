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
