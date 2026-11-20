import { createClient } from "redis";
import { env } from "./config";

const client = createClient({ url: env.REDIS_URL });
client.on("error", (error) => console.error("Redis cache error", error instanceof Error ? error.message : error));

export async function startCache() { if (!client.isOpen) await client.connect(); }
export async function stopCache() { if (client.isOpen) await client.quit(); }
export async function cacheReady() { return client.isReady && await client.ping() === "PONG"; }
export async function getCached<T>(key: string): Promise<T | null> { if (!client.isReady) return null; const value = await client.get(key); return value ? JSON.parse(value) as T : null; }
export async function setCached(key: string, value: unknown, seconds = 60) { if (client.isReady) await client.set(key, JSON.stringify(value), { EX: seconds }); }
export async function deleteCached(key: string) { if (client.isReady) await client.del(key); }
export const cartCacheKey = (userId: string) => `cart:${userId}`;
