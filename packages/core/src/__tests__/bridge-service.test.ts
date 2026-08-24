import { BridgeService } from '../bridge-service.js';

describe('BridgeService', () => {
  let bridgeService: BridgeService;

  beforeEach(() => {
    bridgeService = new BridgeService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Request Management', () => {
    test('should create and store a pending request', async () => {
      const endpoint = '/api/test';
      const data = { test: 'data' };

      const requestPromise = bridgeService.sendRequest(endpoint, data);

      const pendingRequest = bridgeService.getPendingRequest();
      expect(pendingRequest).toBeTruthy();
      expect(pendingRequest?.request.endpoint).toBe(endpoint);
      expect(pendingRequest?.request.data).toEqual(data);
    });

    test('should resolve request when response is received', async () => {
      const endpoint = '/api/test';
      const data = { test: 'data' };
      const response = { result: 'success' };

      const requestPromise = bridgeService.sendRequest(endpoint, data);
      const pendingRequest = bridgeService.getPendingRequest();

      bridgeService.resolveRequest(pendingRequest!.requestId, response);

      const result = await requestPromise;
      expect(result).toEqual(response);
    });

    test('should reject request on error', async () => {
      const endpoint = '/api/test';
      const data = { test: 'data' };
      const error = 'Test error';

      const requestPromise = bridgeService.sendRequest(endpoint, data);
      const pendingRequest = bridgeService.getPendingRequest();

      bridgeService.rejectRequest(pendingRequest!.requestId, error);

      await expect(requestPromise).rejects.toEqual(error);
    });

    test('should timeout request after 30 seconds', async () => {
      const endpoint = '/api/test';
      const data = { test: 'data' };

      const requestPromise = bridgeService.sendRequest(endpoint, data);

      jest.advanceTimersByTime(31000);

      await expect(requestPromise).rejects.toThrow('Request timeout');
    });
  });

  describe('Cleanup Operations', () => {
    test('should clean up old requests', async () => {

      const promises = [
        bridgeService.sendRequest('/api/test1', {}),
        bridgeService.sendRequest('/api/test2', {}),
        bridgeService.sendRequest('/api/test3', {})
      ];

      jest.advanceTimersByTime(31000);

      bridgeService.cleanupOldRequests();

      for (const promise of promises) {
        await expect(promise).rejects.toThrow('Request timeout');
      }

      expect(bridgeService.getPendingRequest()).toBeNull();
    });

    test('should clear all pending requests on disconnect', async () => {

      const promises = [
        bridgeService.sendRequest('/api/test1', {}),
        bridgeService.sendRequest('/api/test2', {}),
        bridgeService.sendRequest('/api/test3', {})
      ];

      bridgeService.clearAllPendingRequests();

      for (const promise of promises) {
        await expect(promise).rejects.toThrow('Connection closed');
      }

      expect(bridgeService.getPendingRequest()).toBeNull();
    });
  });

  describe('Request Priority', () => {
    test('should return oldest request first', async () => {

      bridgeService.sendRequest('/api/test1', { order: 1 });

      jest.advanceTimersByTime(10);

      bridgeService.sendRequest('/api/test2', { order: 2 });

      jest.advanceTimersByTime(10);

      bridgeService.sendRequest('/api/test3', { order: 3 });

      const firstRequest = bridgeService.getPendingRequest();
      expect(firstRequest?.request.data.order).toBe(1);

      bridgeService.resolveRequest(firstRequest!.requestId, {});

      const secondRequest = bridgeService.getPendingRequest();
      expect(secondRequest?.request.data.order).toBe(2);

      bridgeService.resolveRequest(secondRequest!.requestId, {});

      const thirdRequest = bridgeService.getPendingRequest();
      expect(thirdRequest?.request.data.order).toBe(3);

      bridgeService.resolveRequest(thirdRequest!.requestId, {});

      expect(bridgeService.getPendingRequest()).toBeNull();
    });
  });

  describe('single delivery across instances sharing a role', () => {
    // Every Studio opened in edit mode registers as role 'edit'. Before requests were
    // claimed on handout, two open places both received the SAME request and both ran
    // it: one applied the write, the other answered "Instance not found", and whichever
    // response arrived first won. Callers that saw the error retried, appending another
    // copy of the edit every time.
    it('hands a request to only one of two instances on the same role', () => {
      bridgeService.registerInstance('studio-a', 'edit');
      bridgeService.registerInstance('studio-b', 'edit');
      bridgeService.sendRequest('/api/edit', { script: 'A' });

      const toA = bridgeService.getPendingRequest('edit', 'studio-a');
      const toB = bridgeService.getPendingRequest('edit', 'studio-b');

      expect(toA).toBeTruthy();
      expect(toB).toBeNull();
    });

    it('lets the claiming instance re-poll after a dropped response', () => {
      bridgeService.registerInstance('studio-a', 'edit');
      bridgeService.sendRequest('/api/edit', { script: 'A' });

      const first = bridgeService.getPendingRequest('edit', 'studio-a');
      const again = bridgeService.getPendingRequest('edit', 'studio-a');

      expect(again?.requestId).toBe(first!.requestId);
    });

    it('refuses a claimed request to an anonymous poller', () => {
      bridgeService.registerInstance('studio-a', 'edit');
      bridgeService.sendRequest('/api/edit', { script: 'A' });

      expect(bridgeService.getPendingRequest('edit', 'studio-a')).toBeTruthy();
      expect(bridgeService.getPendingRequest('edit')).toBeNull();
    });

    it('routes to the preferred instance when two share a role', () => {
      bridgeService.registerInstance('studio-a', 'edit');
      bridgeService.registerInstance('studio-b', 'edit');
      bridgeService.setPreferredInstance('studio-b');
      bridgeService.sendRequest('/api/edit', { script: 'A' });

      expect(bridgeService.getPendingRequest('edit', 'studio-a')).toBeNull();
      expect(bridgeService.getPendingRequest('edit', 'studio-b')).toBeTruthy();
    });

    it('does not let a preference on one role starve another role', () => {
      bridgeService.registerInstance('studio-a', 'edit');
      const clientRole = bridgeService.registerInstance('studio-c', 'client');
      bridgeService.setPreferredInstance('studio-a');
      bridgeService.sendRequest('/api/play', {}, clientRole);

      expect(bridgeService.getPendingRequest(clientRole, 'studio-c')).toBeTruthy();
    });

    it('ignores a preference for an instance that has disconnected', () => {
      bridgeService.registerInstance('studio-a', 'edit');
      bridgeService.registerInstance('studio-b', 'edit');
      bridgeService.setPreferredInstance('studio-b');
      bridgeService.unregisterInstance('studio-b');
      bridgeService.sendRequest('/api/edit', { script: 'A' });

      // Otherwise every request stalls until timeout, waiting on a Studio that is gone.
      expect(bridgeService.getPendingRequest('edit', 'studio-a')).toBeTruthy();
    });

    it('honours a per-request pin over the server-wide preference', () => {
      // Several MCP clients share one bridge. A pin is the caller naming its own Studio,
      // so it must win -- otherwise one client picking a place silently retargets the
      // tool calls of every other client on the machine.
      bridgeService.registerInstance('studio-a', 'edit');
      bridgeService.registerInstance('studio-b', 'edit');
      bridgeService.setPreferredInstance('studio-a');
      bridgeService.sendRequest('/api/edit', { script: 'B' }, 'edit', 'studio-b');

      expect(bridgeService.getPendingRequest('edit', 'studio-a')).toBeNull();
      expect(bridgeService.getPendingRequest('edit', 'studio-b')).toBeTruthy();
    });

    it('keeps two clients pinned to different Studios apart', () => {
      bridgeService.registerInstance('studio-a', 'edit');
      bridgeService.registerInstance('studio-b', 'edit');
      bridgeService.sendRequest('/api/edit', { from: 'claude-1' }, 'edit', 'studio-a');
      bridgeService.sendRequest('/api/edit', { from: 'claude-2' }, 'edit', 'studio-b');

      const toA = bridgeService.getPendingRequest('edit', 'studio-a');
      const toB = bridgeService.getPendingRequest('edit', 'studio-b');

      expect(toA?.request.data.from).toBe('claude-1');
      expect(toB?.request.data.from).toBe('claude-2');
    });

    it('releases the claim when the holder disconnects', () => {
      bridgeService.registerInstance('studio-a', 'edit');
      bridgeService.registerInstance('studio-b', 'edit');
      bridgeService.sendRequest('/api/edit', { script: 'A' });

      const toA = bridgeService.getPendingRequest('edit', 'studio-a');
      expect(toA).toBeTruthy();

      // studio-b still holds the role, so the request must survive and become
      // available again rather than be rejected or stranded until timeout.
      bridgeService.unregisterInstance('studio-a');

      const toB = bridgeService.getPendingRequest('edit', 'studio-b');
      expect(toB?.requestId).toBe(toA!.requestId);
    });
  });
});