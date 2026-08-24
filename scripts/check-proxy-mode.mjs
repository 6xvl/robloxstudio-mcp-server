/**
 * Proves a SECOND robloxstudio-mcp instance reaches Studio through the first one.
 *
 *   node scripts/check-proxy-mode.mjs
 *
 * Requires a primary already running on ROBLOX_STUDIO_PORT (default 58741) with a Studio
 * plugin connected -- i.e. your normal setup, untouched. This spawns one more server the
 * way an MCP client would, speaks JSON-RPC to it over stdio, and calls a read-only tool.
 *
 * Written because "it logs proxy mode" is not the claim. The claim is that a tool call on
 * the second client comes back with real data from the same Studio, and the only way to
 * know that is to make one.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(HERE, '..', 'packages', 'robloxstudio-mcp', 'dist', 'index.js');
const PORT = process.env.ROBLOX_STUDIO_PORT || '58741';
const TIMEOUT_MS = 25_000;

const health = await fetch(`http://localhost:${PORT}/health`).then(r => r.json()).catch(() => null);
if (!health) {
  console.error(`No primary on ${PORT}. Start your normal MCP first, then re-run.`);
  process.exit(1);
}
console.log(`primary on ${PORT}: pluginConnected=${health.pluginConnected} instances=${health.instanceCount}`);
if (!health.pluginConnected) {
  console.error('Primary has no Studio plugin attached — connect Studio, then re-run.');
  process.exit(1);
}

const child = spawn(process.execPath, [ENTRY], { stdio: ['pipe', 'pipe', 'pipe'] });
const stderr = [];
child.stderr.on('data', d => stderr.push(d.toString()));

let buffered = '';
const pending = new Map();
child.stdout.on('data', chunk => {
  buffered += chunk.toString();
  let nl;
  while ((nl = buffered.indexOf('\n')) !== -1) {
    const line = buffered.slice(0, nl).trim();
    buffered = buffered.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    const resolve = pending.get(msg.id);
    if (resolve) { pending.delete(msg.id); resolve(msg); }
  }
});

let nextId = 1;
const rpc = (method, params) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, resolve);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  setTimeout(() => {
    if (pending.delete(id)) reject(new Error(`${method} timed out after ${TIMEOUT_MS}ms`));
  }, TIMEOUT_MS);
});

const fail = (why) => {
  console.error(`\nFAIL: ${why}`);
  console.error('--- child stderr ---\n' + stderr.join(''));
  child.kill();
  process.exit(1);
};

try {
  await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'check-proxy-mode', version: '1' },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const mode = stderr.join('').includes('proxy mode') ? 'proxy' : 'primary';
  console.log(`second instance came up in: ${mode} mode`);
  if (mode !== 'proxy') fail('second instance did not enter proxy mode — it bound a port of its own');

  // A read-only call that can only be answered by a real Studio on the other end.
  const res = await rpc('tools/call', { name: 'get_place_info', arguments: {} });
  if (res.error) fail(`tools/call returned an error: ${JSON.stringify(res.error)}`);

  const text = res.result?.content?.[0]?.text ?? '';
  if (!text) fail('tools/call came back empty — the proxy did not reach Studio');

  console.log('tools/call get_place_info through the proxy ->');
  console.log('  ' + text.replace(/\s+/g, ' ').slice(0, 220));
  console.log('\nPASS: two instances, one Studio, both able to call it.');
  child.kill();
  process.exit(0);
} catch (err) {
  fail(err.message);
}
