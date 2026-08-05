export interface SendPushParams {
  projectId: string;
  accessToken: string;
  token: string;
  title: string;
  body: string;
  tag?: string;
}

export interface SendPushResult {
  ok: boolean;
  invalidToken: boolean;
}

export async function sendPush(params: SendPushParams): Promise<SendPushResult> {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${params.projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: params.token,
        notification: { title: params.title, body: params.body },
        ...(params.tag ? { data: { tag: params.tag } } : {}),
      },
    }),
  });
  if (response.ok) return { ok: true, invalidToken: false };

  const errorBody = (await response.json().catch(() => null)) as { error?: { status?: string } } | null;
  const status = errorBody?.error?.status;
  const invalidToken = status === 'UNREGISTERED' || status === 'NOT_FOUND' || status === 'INVALID_ARGUMENT';
  return { ok: false, invalidToken };
}
