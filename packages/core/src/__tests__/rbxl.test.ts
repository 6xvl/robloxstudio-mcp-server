import * as fs from 'fs';
import * as path from 'path';
import { TOOL_DEFINITIONS } from '../tools/definitions.js';
import { readCredential, resetCredentialCache } from '../env-file.js';

const SRC_DIR = path.resolve(__dirname, '..');

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(full);
      } else if (entry.name.endsWith('.ts')) {
        out.push(full);
      }
    }
  };
  walk(SRC_DIR);
  return out;
}

describe('place file door', () => {
  test('only rbxl.ts interprets place-file bytes', () => {
    const offenders = sourceFiles()
      .filter((file) => path.basename(file) !== 'rbxl.ts')
      .filter((file) => /Buffer\.from\('<roblox!|lz4Decompress|splitChunks/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_DIR, file));

    expect(offenders).toEqual([]);
  });

  test('only the credential clients hold the key and cookie', () => {
    const allowed = new Set(['opencloud-client.ts', 'roblox-cookie-client.ts']);
    const offenders = sourceFiles()
      .filter((file) => !allowed.has(path.basename(file)))
      .filter((file) => /process\.env\.(ROBLOX_OPEN_CLOUD_API_KEY|ROBLOSECURITY)/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_DIR, file));

    expect(offenders).toEqual([]);
  });

  test('place tools are dispatchable over http', () => {
    const httpServer = fs.readFileSync(path.join(SRC_DIR, 'http-server.ts'), 'utf8');
    for (const name of ['place_check', 'place_publish']) {
      expect(TOOL_DEFINITIONS.some((tool) => tool.name === name)).toBe(true);
      expect(httpServer).toContain(`${name}:`);
    }
  });
});

describe('credential loading', () => {
  const ENV_FILE = path.join(__dirname, 'fixture.env');

  afterEach(() => {
    delete process.env.ROBLOX_MCP_ENV_FILE;
    delete process.env.ROBLOX_OPEN_CLOUD_API_KEY;
    if (fs.existsSync(ENV_FILE)) fs.unlinkSync(ENV_FILE);
    resetCredentialCache();
  });

  test('falls back to the env file and accepts aliases', () => {
    fs.writeFileSync(ENV_FILE, '# comment\nROBLOX_OPEN_CLOUD_API_KEY=from-file\nROBLOX_ROBLOSECURITY="cookie-value"\n');
    process.env.ROBLOX_MCP_ENV_FILE = ENV_FILE;
    resetCredentialCache();

    expect(readCredential('ROBLOX_OPEN_CLOUD_API_KEY')).toBe('from-file');
    expect(readCredential('ROBLOSECURITY', 'ROBLOX_ROBLOSECURITY')).toBe('cookie-value');
  });

  test('a real environment variable wins over the file', () => {
    fs.writeFileSync(ENV_FILE, 'ROBLOX_OPEN_CLOUD_API_KEY=from-file\n');
    process.env.ROBLOX_MCP_ENV_FILE = ENV_FILE;
    process.env.ROBLOX_OPEN_CLOUD_API_KEY = 'from-env';
    resetCredentialCache();

    expect(readCredential('ROBLOX_OPEN_CLOUD_API_KEY')).toBe('from-env');
  });

  test('missing file yields empty, not a throw', () => {
    process.env.ROBLOX_MCP_ENV_FILE = path.join(__dirname, 'does-not-exist.env');
    resetCredentialCache();

    expect(readCredential('ROBLOX_OPEN_CLOUD_API_KEY')).toBe('');
  });
});
