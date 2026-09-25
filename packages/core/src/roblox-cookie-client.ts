import { readCredential } from './env-file.js';

export class RobloxCookieClient {
  private cookie: string;
  private csrfToken: string | null = null;

  constructor(cookie?: string) {
    this.cookie = cookie || readCredential('ROBLOSECURITY', 'ROBLOX_ROBLOSECURITY');
  }

  hasCookie(): boolean {
    return !!this.cookie;
  }

  private async fetchWithCsrf(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Cookie: `.ROBLOSECURITY=${this.cookie}`,
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.csrfToken) {
      headers['X-CSRF-TOKEN'] = this.csrfToken;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 403) {
      const newToken = response.headers.get('x-csrf-token');
      if (newToken) {
        this.csrfToken = newToken;
        headers['X-CSRF-TOKEN'] = newToken;
        return fetch(url, { ...options, headers });
      }
    }

    return response;
  }

  async uploadDecal(
    fileContent: Buffer,
    name: string,
    description: string
  ): Promise<{ assetId: number; backingAssetId: number }> {
    if (!this.cookie) {
      throw new Error('ROBLOSECURITY cookie is not set.');
    }

    const encodedName = encodeURIComponent(name);
    const encodedDesc = encodeURIComponent(description);
    const url = `https://data.roblox.com/data/upload/json?assetTypeId=13&name=${encodedName}&description=${encodedDesc}`;

    const response = await this.fetchWithCsrf(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'User-Agent': 'RobloxStudio/WinInet',
        Requester: 'Client',
      },
      body: new Uint8Array(fileContent),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Decal upload failed (${response.status}): ${body}`);
    }

    const result = await response.json() as {
      Success: boolean;
      AssetId?: number;
      BackingAssetId?: number;
      Message?: string;
    };

    if (!result.Success || !result.AssetId) {
      throw new Error(`Decal upload failed: ${result.Message || 'Unknown error'}`);
    }

    return {
      assetId: result.AssetId,
      backingAssetId: result.BackingAssetId || 0,
    };
  }

  /** Downloads the currently published place file. Returns raw bytes, gzip included. */
  async downloadPlace(placeId: number, version?: number): Promise<Buffer> {
    if (!this.cookie) {
      throw new Error('ROBLOSECURITY cookie is not set. It is required to download a place file.');
    }

    const versionParam = version === undefined ? '' : `&version=${version}`;
    const response = await this.fetchWithCsrf(
      `https://assetdelivery.roblox.com/v1/asset/?id=${placeId}${versionParam}`,
      { headers: { 'User-Agent': 'RobloxStudio/WinInet' } }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Downloading place ${placeId} failed (${response.status}): ${body}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Newest published version number, or null if none is readable. Publishing can return 5xx
   * after the version was actually created, so this is how a failed POST gets adjudicated.
   */
  async latestPublishedVersion(placeId: number): Promise<number | null> {
    if (!this.cookie) return null;

    const response = await this.fetchWithCsrf(
      `https://develop.roblox.com/v1/assets/${placeId}/published-versions?limit=10`
    );
    if (!response.ok) return null;

    const body = (await response.json()) as { data?: Array<{ assetVersionNumber?: number }> };
    const versions = (body.data ?? [])
      .map((entry) => entry.assetVersionNumber)
      .filter((value): value is number => typeof value === 'number');

    return versions.length > 0 ? Math.max(...versions) : null;
  }

  async getAssetDetails(
    assetIds: number[]
  ): Promise<Array<Record<string, unknown>>> {
    if (!this.cookie) {
      throw new Error('ROBLOSECURITY cookie is not set.');
    }

    const response = await this.fetchWithCsrf(
      'https://itemconfiguration.roblox.com/v1/creations/get-asset-details',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to get asset details (${response.status}): ${body}`);
    }

    return response.json() as Promise<Array<Record<string, unknown>>>;
  }
}
