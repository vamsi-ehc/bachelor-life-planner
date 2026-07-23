import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendPush } from './fcm';

describe('sendPush', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts a notification message to the FCM v1 endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendPush({
      projectId: 'proj1',
      accessToken: 'token1',
      token: 'device-token',
      title: 'Workout time',
      body: "It's time for your workout.",
    });

    expect(result).toEqual({ ok: true, invalidToken: false });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://fcm.googleapis.com/v1/projects/proj1/messages:send');
    expect(JSON.parse(options.body)).toEqual({
      message: { token: 'device-token', notification: { title: 'Workout time', body: "It's time for your workout." } },
    });
  });

  it('reports invalidToken when FCM returns UNREGISTERED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { status: 'UNREGISTERED' } }) }),
    );

    const result = await sendPush({ projectId: 'proj1', accessToken: 'token1', token: 'stale', title: 't', body: 'b' });

    expect(result).toEqual({ ok: false, invalidToken: true });
  });

  it('does not report invalidToken for other errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { status: 'INTERNAL' } }) }),
    );

    const result = await sendPush({ projectId: 'proj1', accessToken: 'token1', token: 't', title: 't', body: 'b' });

    expect(result).toEqual({ ok: false, invalidToken: false });
  });
});
