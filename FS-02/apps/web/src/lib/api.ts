export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4100/api/v1";
export class ApiError extends Error { constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); } }
const csrf = () => document.cookie.split("; ").find((item) => item.startsWith("aureva_csrf="))?.split("=")[1];
export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const method = options.method ?? "GET"; const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("content-type", "application/json");
  if (!["GET", "HEAD"].includes(method.toUpperCase()) && csrf()) headers.set("x-csrf-token", decodeURIComponent(csrf()!));
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  if (response.status === 401 && retry && path !== "/auth/refresh") { const refreshed = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" }); if (refreshed.ok) return api<T>(path, options, false); }
  const payload = await response.json().catch(() => ({ success: false, error: { code: "INVALID_RESPONSE", message: "Invalid server response" } }));
  if (!response.ok || !payload.success) throw new ApiError(response.status, payload.error?.code ?? "REQUEST_FAILED", payload.error?.message ?? "Request failed", payload.error?.details);
  return payload.data as T;
}
export async function apiWithMeta<T>(path:string,options:RequestInit={}):Promise<{data:T;meta:Record<string,unknown>}>{
  const method=options.method??"GET";const headers=new Headers(options.headers);if(options.body&&!(options.body instanceof FormData))headers.set("content-type","application/json");if(!["GET","HEAD"].includes(method.toUpperCase())&&csrf())headers.set("x-csrf-token",decodeURIComponent(csrf()!));
  const response=await fetch(`${API_URL}${path}`,{...options,headers,credentials:"include"});const payload=await response.json().catch(()=>({success:false,error:{code:"INVALID_RESPONSE",message:"Invalid server response"}}));if(!response.ok||!payload.success)throw new ApiError(response.status,payload.error?.code??"REQUEST_FAILED",payload.error?.message??"Request failed",payload.error?.details);return {data:payload.data as T,meta:payload.meta??{}};
}
export const post = <T>(path: string, body?: unknown, headers?: HeadersInit) => api<T>(path, { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...(headers ? { headers } : {}) });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const remove = <T>(path: string) => api<T>(path, { method: "DELETE" });
