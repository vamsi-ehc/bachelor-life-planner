import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccessToken } from './googleAuth';

function arrayBufferToPem(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
}

async function makeTestKeyPem(): Promise<string> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const exported = (await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)) as ArrayBuffer;
  return arrayBufferToPem(exported);
}

describe('getAccessToken', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('signs a JWT and exchanges it for an access token', async () => {
    const privateKeyPem = await makeTestKeyPem();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'test-access-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const token = await getAccessToken(
      { client_email: 'worker@test-project.iam.gserviceaccount.com', private_key: privateKeyPem },
      ['https://www.googleapis.com/auth/datastore'],
    );

    expect(token).toBe('test-access-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(options.method).toBe('POST');
    const body = options.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const assertion = body.get('assertion') ?? '';
    expect(assertion.split('.')).toHaveLength(3);
  });

  it('throws when the token endpoint rejects the request', async () => {
    const privateKeyPem = await makeTestKeyPem();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid_grant' }),
    );

    await expect(
      getAccessToken({ client_email: 'x@y.iam.gserviceaccount.com', private_key: privateKeyPem }, ['scope']),
    ).rejects.toThrow('Google token exchange failed');
  });
});
