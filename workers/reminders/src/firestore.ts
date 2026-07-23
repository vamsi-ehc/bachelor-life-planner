type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function decodeValue(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields);
  return null;
}

function encodeFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = encodeValue(v);
  return fields;
}

function decodeFields(fields: Record<string, FirestoreValue> | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) result[k] = decodeValue(v);
  return result;
}

function baseUrl(projectId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

export async function getDocument(
  projectId: string,
  accessToken: string,
  path: string,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${baseUrl(projectId)}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore getDocument failed: ${response.status}`);
  const json = (await response.json()) as { fields?: Record<string, FirestoreValue> };
  return decodeFields(json.fields);
}

export async function listDocuments(
  projectId: string,
  accessToken: string,
  path: string,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const response = await fetch(`${baseUrl(projectId)}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Firestore listDocuments failed: ${response.status}`);
  const json = (await response.json()) as {
    documents?: Array<{ name: string; fields?: Record<string, FirestoreValue> }>;
  };
  return (json.documents ?? []).map((d) => ({
    id: d.name.split('/').pop() as string,
    data: decodeFields(d.fields),
  }));
}

export async function patchDocument(
  projectId: string,
  accessToken: string,
  path: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const mask = Object.keys(fields)
    .map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`)
    .join('&');
  const response = await fetch(`${baseUrl(projectId)}/${path}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(fields) }),
  });
  if (!response.ok) throw new Error(`Firestore patchDocument failed: ${response.status}`);
}

export async function deleteDocument(projectId: string, accessToken: string, path: string): Promise<void> {
  const response = await fetch(`${baseUrl(projectId)}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Firestore deleteDocument failed: ${response.status}`);
  }
}
