/**
 * Thin fetch helpers. All requests go to the same origin; Next.js
 * proxies /api/* to the Java backend server-side.
 */

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function throwApiError(res: Response): Promise<never> {
  let message = "Something went wrong on our side. Please try again.";
  let code = "UNKNOWN";
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
    if (body?.code) code = body.code;
  } catch {
    /* non-JSON error body — keep the generic message */
  }
  throw new ApiError(message, code, res.status);
}

/** POST multipart form data, expect JSON back. */
export async function postForm<T>(
  path: string,
  fields: Record<string, string | Blob | undefined>,
): Promise<T> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, value);
  }
  const res = await fetch(path, { method: "POST", body: form });
  if (!res.ok) await throwApiError(res);
  return res.json();
}

/** POST multipart form data, expect a binary file + X-Steglab-Meta JSON. */
export async function postFormForFile<M>(
  path: string,
  fields: Record<string, string | Blob | undefined>,
): Promise<{ blob: Blob; meta: M; filename: string | null }> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, value);
  }
  const res = await fetch(path, { method: "POST", body: form });
  if (!res.ok) await throwApiError(res);

  const metaHeader = res.headers.get("X-Steglab-Meta");
  const meta = (metaHeader ? JSON.parse(metaHeader) : {}) as M;

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);

  return {
    blob: await res.blob(),
    meta,
    filename: match ? match[1] : null,
  };
}

/** POST a JSON body, expect JSON back. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res);
  return res.json();
}
