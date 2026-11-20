import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function createOpaqueToken(size = 32): string {
  return randomBytes(size).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function hashKeyedToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createInternalRequestSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  body: string,
): string {
  return createHmac("sha256", secret)
    .update(`${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`)
    .digest("base64url");
}

export function verifyInternalRequestSignature(options: {
  secret: string;
  method: string;
  path: string;
  timestamp: string;
  body: string;
  signature: string;
  now?: number;
  maxAgeMs?: number;
}): boolean {
  const issuedAt = Number(options.timestamp);
  const now = options.now ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? 60_000;
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now + 5_000 || now - issuedAt > maxAgeMs) return false;
  const expected = createInternalRequestSignature(
    options.secret,
    options.method,
    options.path,
    options.timestamp,
    options.body,
  );
  return safeEqual(options.signature, expected);
}

export function createCsrfToken(secret: string, now = Date.now()): string {
  const nonce = createOpaqueToken(24);
  const timestamp = now.toString(36);
  const payload = `${nonce}.${timestamp}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyCsrfToken(token: string, secret: string, now = Date.now()): boolean {
  const [nonce, timestamp, signature, ...extra] = token.split(".");
  if (!nonce || !timestamp || !signature || extra.length > 0) {
    return false;
  }

  const issuedAt = Number.parseInt(timestamp, 36);
  const maxAgeMs = 2 * 60 * 60 * 1_000;
  if (!Number.isFinite(issuedAt) || issuedAt > now + 60_000 || now - issuedAt > maxAgeMs) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${nonce}.${timestamp}`)
    .digest("base64url");

  return safeEqual(signature, expected);
}
