import type { ApiErrorBody } from "@nexvia/shared";

const apiUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");

let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

async function refreshCsrfToken(): Promise<string> {
  const response = await fetch(`${apiUrl}/auth/csrf`, {
    method: "GET",
    credentials: "include",
    headers: { accept: "application/json" },
  });
  const body = (await parseBody(response)) as { csrfToken?: string } | undefined;

  if (!response.ok || !body?.csrfToken) {
    throw new ApiError(response.status, "CSRF_INITIALIZATION_FAILED", "Could not initialize a secure request");
  }

  csrfToken = body.csrfToken;
  return csrfToken;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retryAfterCsrfFailure = true,
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (mutating && !csrfToken) {
    await refreshCsrfToken();
  }

  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (mutating && csrfToken) {
    headers.set("x-csrf-token", csrfToken);
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const body = await parseBody(response);

  if (!response.ok) {
    const apiError = body as ApiErrorBody | undefined;
    const code = apiError?.error?.code ?? "REQUEST_FAILED";

    if (response.status === 403 && code === "INVALID_CSRF_TOKEN" && mutating && retryAfterCsrfFailure) {
      await refreshCsrfToken();
      return request<T>(path, init, false);
    }

    throw new ApiError(
      response.status,
      code,
      apiError?.error?.message ?? `Request failed with status ${response.status}`,
      apiError?.error?.details,
    );
  }

  const responseCsrf = (body as { csrfToken?: string } | undefined)?.csrfToken;
  if (responseCsrf) {
    csrfToken = responseCsrf;
  }

  return body as T;
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },
};
